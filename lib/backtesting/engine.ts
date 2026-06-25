/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BacktestConfig,
  BacktestModel,
  BacktestPredictionRecord,
  BacktestTrade,
  TickerBacktestResult,
  EquityPoint,
} from './types';
import { fetchMarketData } from '../market-data/provider';
import { OHLCVData } from '../market-data/types';
import { updateJobStatus, getCached, putCache, isCacheWarm } from './data-cache';
import { calculateMetrics } from './metrics';
import { computeIndicatorsFromHistory } from './data-fetcher';
import { generatePrediction } from '../prediction-engine';
import { getStockSector } from './stock-universe';

function getDateRange(timeframe: string): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date(endDate);
  
  const mapping: Record<string, number> = {
    '1D': 1/365, '7D': 7/365, '30D': 30/365, '90D': 90/365, '365D': 1,
    '1Y': 1, '2Y': 2, '3Y': 3, '5Y': 5, '10Y': 10,
  };
  
  const years = mapping[timeframe] || 1;
  startDate.setFullYear(startDate.getFullYear() - Math.floor(years));
  if (years < 1) {
    startDate.setDate(startDate.getDate() - Math.round(years * 365));
  }
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export async function runBacktestEngine(jobId: string, config: BacktestConfig) {
  const { startDate, endDate } = config.startDate && config.endDate 
    ? { startDate: config.startDate, endDate: config.endDate }
    : getDateRange(config.timeframe);

  const tickers = config.tickers;
  const tickerResults: TickerBacktestResult[] = [];
  
  updateJobStatus(jobId, {
    status: 'RUNNING',
    phase: 'Initializing',
    progress: 0,
    startedAt: new Date().toISOString(),
  });

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    
    updateJobStatus(jobId, {
      currentTicker: ticker,
      phase: `Fetching data for ${ticker}`,
      progress: Math.round((i / tickers.length) * 100),
      completedTickers: i,
    });

    let bars: OHLCVData[] = [];
    let sourceUsed = 'Cache';
    let failedLogs: string[] = [];
    
    try {
      if (isCacheWarm(ticker, startDate, endDate)) {
        bars = getCached(ticker, startDate, endDate) as OHLCVData[];
      } else {
        const result = await fetchMarketData({ 
          ticker, 
          startDate, 
          endDate,
          preferredSource: config.dataSource
        });
        bars = result.data;
        sourceUsed = result.source;
        failedLogs = result.logs;
        putCache(ticker, bars as any);
      }
    } catch (err: any) {
      console.error(`[Backtest Engine] Data fetch failed for ${ticker}:`, err.message);
      failedLogs.push(err.message);
      // Create empty result with error logs
      tickerResults.push(createEmptyResult(ticker, failedLogs));
      continue;
    }

    if (bars.length < 50) {
      failedLogs.push(`Insufficient data: ${bars.length} bars`);
      tickerResults.push(createEmptyResult(ticker, failedLogs));
      continue;
    }

    // Run strategy
    updateJobStatus(jobId, {
      phase: `Simulating ${ticker}`,
    });

    try {
      const result = await simulateTrading(ticker, bars, config, sourceUsed, failedLogs);
      tickerResults.push(result);
    } catch (err: any) {
       console.error(`[Backtest Engine] Simulation failed for ${ticker}:`, err);
       tickerResults.push(createEmptyResult(ticker, [...failedLogs, `Simulation error: ${err.message}`]));
    }
  }

  updateJobStatus(jobId, {
    status: 'COMPLETED',
    phase: 'Complete',
    progress: 100,
    completedAt: new Date().toISOString(),
    completedTickers: tickers.length,
  });

  return { tickerResults };
}

async function simulateTrading(
  ticker: string, 
  bars: OHLCVData[], 
  config: BacktestConfig,
  sourceUsed: string,
  failedSourceLogs: string[]
): Promise<TickerBacktestResult> {
  let capital = config.initialCapital || 10000;
  const positionSizing = (config.positionSizing || 100) / 100;
  const stopLoss = (config.stopLoss || 5) / 100;
  const takeProfit = (config.takeProfit || 10) / 100;
  const confidenceFilter = config.confidenceFilter || 0;

  const trades: BacktestTrade[] = [];
  const records: BacktestPredictionRecord[] = [];
  const equityCurve: EquityPoint[] = [];
  
  let currentPosition: { price: number, size: number, type: 'UP' | 'DOWN', model: BacktestModel, date: string, confidence: number } | null = null;
  
  // Debug tracking
  const debugStats = {
    candlesLoaded: bars.length,
    signalsGenerated: 0,
    tradesOpened: 0,
    tradesClosed: 0,
    tradesRejected: 0,
    rejectionReasons: {} as Record<string, number>
  };

  const trackRejection = (reason: string) => {
    debugStats.tradesRejected++;
    debugStats.rejectionReasons[reason] = (debugStats.rejectionReasons[reason] || 0) + 1;
  };

  // Need at least 200 bars for SMA200 indicator. If less than 200, we start at 50 (or whatever is available) to avoid skipping everything.
  const startIndex = Math.min(200, Math.max(50, Math.floor(bars.length / 2))); 
  
  for (let i = startIndex; i < bars.length; i++) {
    const bar = bars[i];
    const price = bar.adjClose ?? bar.close;
    
    // Check for exits if in a position
    if (currentPosition) {
      const returnPct = currentPosition.type === 'UP' 
        ? (price - currentPosition.price) / currentPosition.price
        : (currentPosition.price - price) / currentPosition.price;
        
      let exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TIME_EXIT' | null = null;
      
      if (returnPct <= -stopLoss) {
        exitReason = 'STOP_LOSS';
      } else if (returnPct >= takeProfit) {
        exitReason = 'TAKE_PROFIT';
      } else if (i === bars.length - 1) {
        exitReason = 'TIME_EXIT';
      }
      
      if (exitReason) {
        const tradeProfit = currentPosition.size * returnPct;
        capital += tradeProfit;
        
        trades.push({
          tradeId: `TRD_${ticker}_${i}`,
          date: currentPosition.date,
          exitDate: bar.date,
          ticker,
          model: currentPosition.model,
          direction: currentPosition.type,
          entryPrice: currentPosition.price,
          exitPrice: price,
          returnPct: returnPct * 100,
          profitAmount: tradeProfit,
          isWin: tradeProfit > 0,
          regime: 'SIDEWAYS', // simplification, can be updated via engine
          exitReason,
          confidence: currentPosition.confidence,
        });
        
        debugStats.tradesClosed++;
        currentPosition = null;
      }
    }
    
    // Record equity
    const unrealizedPnL = currentPosition 
      ? currentPosition.size * (currentPosition.type === 'UP' ? (price - currentPosition.price)/currentPosition.price : (currentPosition.price - price)/currentPosition.price)
      : 0;
      
    equityCurve.push({
      date: bar.date,
      equity: capital + unrealizedPnL,
      drawdown: 0 // Will be computed in metrics.ts
    });

    // Check for entries
    if (!currentPosition) {
      if (config.maxTrades && trades.length >= config.maxTrades) {
        // Stop evaluating new entries if max trades reached
        continue;
      }
      
      const indicators = computeIndicatorsFromHistory(bars as any, i);
      if (!indicators) {
        trackRejection('No indicators available');
        continue;
      }

      const model = config.models[0] || 'V1';
      const prediction = generatePrediction(
        ticker, price, bar.volume, bars.slice(0, i+1) as any, indicators as any, undefined, model as any, config.predictionHorizon
      );

      if (prediction.direction !== 'NEUTRAL') {
        debugStats.signalsGenerated++;
        
        if (prediction.confidence < confidenceFilter) {
          trackRejection(`Confidence too low (${prediction.confidence} < ${confidenceFilter})`);
          continue;
        }

        // Apply Signal Strength Filter
        if (config.signalStrengthFilter === 'STRONG_ONLY' && prediction.signalStrength !== 'STRONG_SIGNAL') {
          trackRejection(`Signal strength too weak (${prediction.signalStrength})`);
          continue;
        }
        if (config.signalStrengthFilter === 'MODERATE_STRONG' && prediction.signalStrength === 'WEAK_SIGNAL') {
          trackRejection(`Signal strength too weak (${prediction.signalStrength})`);
          continue;
        }

        const positionAmount = capital * positionSizing;
        currentPosition = {
          price,
          size: positionAmount,
          type: prediction.direction,
          model,
          date: bar.date,
          confidence: prediction.confidence
        };
        debugStats.tradesOpened++;

        records.push({
          date: bar.date,
          ticker,
          model,
          direction: prediction.direction,
          confidence: prediction.confidence,
          signalStrength: prediction.signalStrength,
          predictedReturn: prediction.expectedReturns?.base ?? 0,
          actualReturn: 0, // populated on exit
          result: 'PENDING',
          regime: (prediction.regime as any) ?? 'SIDEWAYS',
          horizon: config.predictionHorizon,
          indicators: {
            rsi14: indicators.rsi14,
            macdHistogram: indicators.macd?.histogram ?? 0,
            sma200Diff: ((price - indicators.sma200) / indicators.sma200) * 100,
            atrRatio: indicators.atr14 / price,
          }
        });
      }
    }
  }

  const metrics = calculateMetrics(config.initialCapital || 10000, trades, equityCurve);

  return {
    ticker,
    sector: getStockSector(ticker),
    totalTrades: trades.length,
    winRate: metrics.winRate,
    lossRate: metrics.lossRate,
    profitAndLoss: metrics.profitAndLoss,
    cagr: metrics.cagr,
    maxDrawdown: metrics.maxDrawdown,
    sharpeRatio: metrics.sharpeRatio,
    averageWin: metrics.averageWin,
    averageLoss: metrics.averageLoss,
    winLossRatio: metrics.winLossRatio,
    
    totalPredictions: records.length,
    verifiedPredictions: records.length,
    correctCount: trades.filter(t => t.isWin).length,
    incorrectCount: trades.filter(t => !t.isWin).length,
    partialCount: 0,
    neutralCount: 0,
    accuracy: metrics.winRate,
    precision: 0,
    recall: 0,
    f1Score: 0,
    averageError: 0,
    medianError: 0,
    confidenceCalibrationError: 0,
    regimeBreakdown: {} as any,
    timeframeBreakdown: {},
    
    records,
    trades,
    equityCurve,
    drawdownCurve: metrics.drawdownCurve,
    
    sourceUsed,
    failedSourceLogs,
    debugStats
  };
}

function createEmptyResult(ticker: string, failedSourceLogs: string[]): TickerBacktestResult {
  return {
    ticker,
    sector: getStockSector(ticker),
    totalTrades: 0,
    winRate: 0,
    lossRate: 0,
    profitAndLoss: 0,
    cagr: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    averageWin: 0,
    averageLoss: 0,
    winLossRatio: 0,
    
    totalPredictions: 0,
    verifiedPredictions: 0,
    correctCount: 0,
    incorrectCount: 0,
    partialCount: 0,
    neutralCount: 0,
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    averageError: 0,
    medianError: 0,
    confidenceCalibrationError: 0,
    regimeBreakdown: {} as any,
    timeframeBreakdown: {},
    
    records: [],
    trades: [],
    equityCurve: [],
    drawdownCurve: [],
    failedSourceLogs
  };
}
