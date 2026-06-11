// ─── Core Backtesting Engine ──────────────────────────────────────────────────
// Orchestrates the full backtest: fetch data, compute indicators, run predictions,
// evaluate outcomes, and aggregate results.

import {
  BacktestConfig,
  BacktestModel,
  BacktestPredictionRecord,
  TickerBacktestResult,
  StressTestResult,
  WalkForwardWindowResult,
  OHLCVBar,
  MarketRegime,
} from './types';
import { fetchHistoricalOHLCV, computeIndicatorsFromHistory } from './data-fetcher';
import { getCached, putCache, isCacheWarm, updateJobStatus } from './data-cache';
import { getStockSector } from './stock-universe';
import { computeTickerStats } from './accuracy-analytics';
import { STRESS_SCENARIOS } from './stress-scenarios';
import { generateWalkForwardWindows, aggregateWalkForwardResults, filterRecordsByWindow, computeWindowStats } from './walk-forward';
import { generatePrediction } from '../prediction-engine';

// ─── Timeframe → Date Range ───────────────────────────────────────────────────

function getDateRange(timeframe: string): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date(endDate);
  const years = {
    '1Y': 1, '3Y': 3, '5Y': 5, '10Y': 10,
    '20Y': 20, '30Y': 30, '40Y': 40, '50Y': 50,
  }[timeframe] ?? 10;
  startDate.setFullYear(startDate.getFullYear() - years);
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

// ─── Prediction Horizon → Days ────────────────────────────────────────────────

function horizonToDays(horizon: string): number {
  return { '1D': 1, '7D': 7, '30D': 30, '90D': 90 }[horizon] ?? 7;
}

// ─── Model Version Mapping ────────────────────────────────────────────────────

function modelToVersion(model: BacktestModel): 'V1' | 'V2' | 'V3' {
  if (model === 'V2') return 'V2';
  if (model === 'V3' || model === 'REGIME') return 'V3';
  return 'V1';
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function runBacktest(
  jobId: string,
  config: BacktestConfig
): Promise<{
  tickerResults: TickerBacktestResult[];
  allRecords: BacktestPredictionRecord[];
  walkForwardResult?: any;
}> {
  const { startDate, endDate } = getDateRange(config.timeframe);
  const tickers = config.tickers;
  const allRecords: BacktestPredictionRecord[] = [];
  const tickerResults: TickerBacktestResult[] = [];

  updateJobStatus(jobId, {
    status: 'RUNNING',
    phase: 'Fetching historical data',
    startedAt: new Date().toISOString(),
    progress: 0,
  });

  for (let t = 0; t < tickers.length; t++) {
    const ticker = tickers[t];
    updateJobStatus(jobId, {
      currentTicker: ticker,
      phase: `Processing ${ticker}`,
      progress: Math.round((t / tickers.length) * 80),
      completedTickers: t,
    });

    try {
      // ─── Fetch/Cache OHLCV Data ─────────────────────────────────────────
      let bars: OHLCVBar[];
      if (isCacheWarm(ticker, startDate, endDate)) {
        bars = getCached(ticker, startDate, endDate);
      } else {
        bars = await fetchHistoricalOHLCV(ticker, startDate, endDate);
        if (bars.length > 0) putCache(ticker, bars);
      }

      if (bars.length < 250) {
        console.warn(`[BacktestEngine] Insufficient data for ${ticker}: ${bars.length} bars`);
        continue;
      }

      // ─── Run predictions for each model ──────────────────────────────────
      const models: BacktestModel[] = config.models.includes('ALL')
        ? ['V1', 'V2', 'V3', 'REGIME', 'META']
        : config.models.filter(m => m !== 'ALL');

      const tickerRecords = await runTickerBacktest(ticker, bars, models, config);
      allRecords.push(...tickerRecords);

      // ─── Compute per-ticker stats ─────────────────────────────────────────
      const sector = getStockSector(ticker);
      const tickerAllRecords = tickerRecords.filter(r => r.model === (models[0] ?? 'V1'));
      if (tickerAllRecords.length > 0) {
        const stats = computeTickerStats(ticker, sector, tickerAllRecords);
        tickerResults.push(stats);
      }
    } catch (err: any) {
      console.error(`[BacktestEngine] Error processing ${ticker}:`, err.message);
    }
  }

  // ─── Walk-Forward Testing ──────────────────────────────────────────────
  let walkForwardResult;
  if (config.walkForward && config.walkForwardConfig && allRecords.length > 0) {
    updateJobStatus(jobId, { phase: 'Running walk-forward analysis', progress: 82 });
    walkForwardResult = runWalkForwardAnalysis(allRecords, startDate, endDate, config);
  }

  updateJobStatus(jobId, {
    status: 'COMPLETED',
    phase: 'Complete',
    progress: 100,
    completedAt: new Date().toISOString(),
    completedTickers: tickers.length,
  });

  return { tickerResults, allRecords, walkForwardResult };
}

// ─── Per-Ticker Backtest ──────────────────────────────────────────────────────

async function runTickerBacktest(
  ticker: string,
  bars: OHLCVBar[],
  models: BacktestModel[],
  config: BacktestConfig
): Promise<BacktestPredictionRecord[]> {
  const records: BacktestPredictionRecord[] = [];
  const horizonDays = horizonToDays(config.predictionHorizon);

  // Step through each trading day with enough history for indicators
  // We step every 5 days to reduce computation while maintaining coverage
  const STEP = 5;
  const START_INDEX = 200; // Need 200 bars for SMA200

  for (let i = START_INDEX; i < bars.length - horizonDays; i += STEP) {
    const bar = bars[i];
    const indicators = computeIndicatorsFromHistory(bars, i);
    if (!indicators) continue;

    const price = bar.adjClose ?? bar.close;
    const volume = bar.volume;

    // Actual return over horizon period
    const futureBar = bars[i + horizonDays];
    const futurePrice = futureBar.adjClose ?? futureBar.close;
    const actualReturn = ((futurePrice - price) / price) * 100;

    for (const model of models) {
      try {
        const modelVersion = modelToVersion(model);
        const prediction = generatePrediction(
          ticker, price, volume, bars.slice(0, i + 1), indicators, undefined, modelVersion, config.predictionHorizon
        );

        // Determine result
        const predictedReturn = prediction.expectedReturns?.base ?? 0;
        const result = evaluateResult(prediction.direction, actualReturn, predictedReturn);
        const regime = (prediction.regime as MarketRegime) ?? 'SIDEWAYS';

        records.push({
          date: bar.date,
          ticker,
          model,
          direction: prediction.direction,
          confidence: prediction.confidence,
          predictedReturn,
          actualReturn: round(actualReturn),
          result,
          regime,
          horizon: config.predictionHorizon,
          indicators: {
            rsi14: indicators.rsi14,
            macdHistogram: indicators.macd?.histogram ?? 0,
            sma200Diff: ((price - indicators.sma200) / indicators.sma200) * 100,
            atrRatio: indicators.atr14 / price,
          },
        });
      } catch (err: any) {
        // Skip failed predictions
      }
    }
  }

  return records;
}

// ─── Outcome Evaluation ───────────────────────────────────────────────────────

function evaluateResult(
  direction: 'UP' | 'DOWN' | 'NEUTRAL',
  actualReturn: number,
  predictedReturn: number
): 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT' {
  if (direction === 'NEUTRAL') {
    // NEUTRAL is considered PARTIALLY_CORRECT if return is within ±2%
    return Math.abs(actualReturn) <= 2 ? 'PARTIALLY_CORRECT' : 'INCORRECT';
  }

  if (direction === 'UP') {
    if (actualReturn > 2) return 'CORRECT';
    if (actualReturn > 0) return 'PARTIALLY_CORRECT';
    return 'INCORRECT';
  }

  if (direction === 'DOWN') {
    if (actualReturn < -2) return 'CORRECT';
    if (actualReturn < 0) return 'PARTIALLY_CORRECT';
    return 'INCORRECT';
  }

  return 'INCORRECT';
}

// ─── Walk-Forward Analysis ────────────────────────────────────────────────────

function runWalkForwardAnalysis(
  allRecords: BacktestPredictionRecord[],
  startDate: string,
  endDate: string,
  config: BacktestConfig
) {
  const wfConfig = config.walkForwardConfig!;
  const windows = generateWalkForwardWindows(startDate, endDate, wfConfig);

  const windowResults: WalkForwardWindowResult[] = windows.map(window => {
    const trainRecs = filterRecordsByWindow(allRecords, window.trainStart, window.trainEnd);
    const validateRecs = filterRecordsByWindow(allRecords, window.validateStart, window.validateEnd);
    const testRecs = filterRecordsByWindow(allRecords, window.testStart, window.testEnd);

    const trainStats = computeWindowStats(trainRecs);
    const validateStats = computeWindowStats(validateRecs);
    const testStats = computeWindowStats(testRecs);

    return {
      window,
      trainAccuracy: trainStats.accuracy,
      validateAccuracy: validateStats.accuracy,
      testAccuracy: testStats.accuracy,
      trainSharpe: trainStats.sharpe,
      testSharpe: testStats.sharpe,
      predictions: testRecs,
    };
  });

  return aggregateWalkForwardResults(windowResults);
}

// ─── Stress Test Runner ───────────────────────────────────────────────────────

export async function runStressTests(
  jobId: string,
  tickers: string[],
  scenarioKeys: string[],
  model: BacktestModel
): Promise<StressTestResult[]> {
  const results: StressTestResult[] = [];

  for (const scenarioKey of scenarioKeys) {
    const scenario = STRESS_SCENARIOS[scenarioKey as keyof typeof STRESS_SCENARIOS];
    if (!scenario) continue;

    for (const ticker of tickers) {
      try {
        // Fetch stress period data
        let bars: OHLCVBar[];
        if (isCacheWarm(ticker, scenario.startDate, scenario.endDate)) {
          bars = getCached(ticker, scenario.startDate, scenario.endDate);
        } else {
          bars = await fetchHistoricalOHLCV(ticker, scenario.startDate, scenario.endDate);
          if (bars.length > 0) putCache(ticker, bars);
        }

        if (bars.length < 20) continue;

        const config: BacktestConfig = {
          id: jobId,
          name: `Stress-${scenarioKey}`,
          timeframe: '5Y',
          models: [model],
          tickerMode: 'SINGLE',
          tickers: [ticker],
          predictionHorizon: '7D',
          walkForward: false,
          monteCarloEnabled: false,
          stressTestEnabled: true,
          createdAt: new Date().toISOString(),
        };

        const tickerRecords = await runTickerBacktest(ticker, bars, [model], config);
        const verified = tickerRecords.filter(r => r.result !== 'PENDING');
        const correct = verified.filter(r => r.result === 'CORRECT' || r.result === 'PARTIALLY_CORRECT');
        const accuracy = verified.length > 0 ? (correct.length / verified.length) * 100 : 0;

        // Compute drawdown and Sharpe for stress period
        const returns = tickerRecords.map(r => r.actualReturn / 100);
        const avgReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
        const stdReturn = stdDev(returns);
        const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

        // Max drawdown
        let equity = 100, peak = 100, maxDd = 0;
        for (const r of tickerRecords) {
          equity *= (1 + r.actualReturn / 100);
          peak = Math.max(peak, equity);
          maxDd = Math.min(maxDd, ((equity - peak) / peak) * 100);
        }

        // Resilience rating
        const baselineAccuracy = 55; // expected baseline
        const resilience = accuracy >= baselineAccuracy * 0.9
          ? 'RESILIENT'
          : accuracy >= baselineAccuracy * 0.7
          ? 'MODERATE'
          : 'VULNERABLE';

        results.push({
          scenario,
          ticker,
          model,
          accuracy: round(accuracy),
          maxDrawdown: round(Math.abs(maxDd)),
          avgReturn: round(avgReturn * 100),
          winRate: round((correct.length / (verified.length || 1)) * 100),
          sharpe: round(sharpe),
          predictionCount: tickerRecords.length,
          resilience,
        });
      } catch (err: any) {
        console.error(`[BacktestEngine] Stress test error ${ticker}/${scenarioKey}:`, err.message);
      }
    }
  }

  return results;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

function round(val: number): number {
  return Math.round(val * 100) / 100;
}
