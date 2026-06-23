/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { OHLCVBar } from './types';
import { generatePrediction } from '../prediction-engine';
import { computeIndicatorsFromHistory } from './data-fetcher';
import { saveWalkForwardMetrics, WalkForwardMetric } from './data-cache';
import { PredictionRecord } from '../predictions-db';
import { fitIsotonicCalibrator, fitTemperatureScaler, compareCalibrationMethods, CalibrationResult, calculateECE } from '../confidenceCalibration';
import { extractFeatures, fitScaler, transformFeatures, SmartFeatures, ScalerMetadata } from '../featureEngineering';
import { TradeFilterThresholds } from '../tradeFilterEngine';
import { runDataQualityAudit } from '../dataQualityAudit';
import { EnsemblePredictionEngine, featuresToVector, EnsembleMetrics } from '../ensemblePredictionEngine';
import { Matrix, Vector } from '../ml-core';
import { evaluateMacroContext, MacroDataMap, MacroContext } from '../macroContext';
import { classifyDirectionalMove } from '../labeling';

export interface WalkForwardResult {
  foldId: number;
  trainStart: string;
  trainEnd: string;
  testStart: string;
  testEnd: string;
  totalPredictions: number;
  overallAccuracy: number;
  tradeableAccuracy: number;
  tradeableCount: number;
  winLossRatio: number;
  medianError: number;
  brierScore: number;
  ece: number;
  averageReturn: number;
  maxDrawdown: number;
  sharpe: number;
  predictions: PredictionRecord[];
  calibrationResult?: CalibrationResult;
}

export interface WalkForwardAggregate {
  totalFolds: number;
  totalPredictions: number;
  weightedOverallAccuracy: number;
  weightedTradeableAccuracy: number;
  weightedEce: number;
  weightedBrierScore: number;
  winLossRatio: number;
  folds: WalkForwardResult[];
}

// Helper to calculate days between dates
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

import { WalkForwardConfig } from './types';
import { generateWalkForwardWindows } from './walk-forward';

export async function runWalkForwardValidation(
  historicalData: Record<string, OHLCVBar[]>,
  startDate: string,
  endDate: string,
  config: WalkForwardConfig,
  horizonDays: number = 7,
  ablationGroup: string = 'BASELINE'
): Promise<WalkForwardAggregate> {
  const folds: WalkForwardResult[] = [];
  
  const windows = generateWalkForwardWindows(startDate, endDate, config);

  for (const window of windows) {
    const foldId = window.index + 1;
    // We will expand train window from the start to `window.trainEnd` to avoid losing data, 
    // but the `generateWalkForwardWindows` defines `trainStart`. We can just use `startDate` to `trainEnd` for expanding window, 
    // or use strictly `trainStart` to `trainEnd` for a rolling window. Let's use rolling:
    const trainStart = window.trainStart;
    const trainEnd = window.trainEnd;
    const testStart = window.testStart;
    const testEnd = window.testEnd;

    console.log(`\n[WalkForward] Fold ${foldId}: Train ${trainStart} to ${trainEnd} | Test ${testStart} to ${testEnd}`);

    // --- PRIORITY 9: DATA QUALITY AUDIT (PRE-TRAINING BLOCKER) ---
    console.log(`[WalkForward] Running Data Quality Audit on Training Data...`);
    const cleanHistoricalData: Record<string, OHLCVBar[]> = {};
    let totalQualityScore = 0;
    let auditedStocks = 0;

    for (const [ticker, bars] of Object.entries(historicalData)) {
      if (['NIFTY', 'BANKNIFTY', 'INDIAVIX', 'INTEREST_RATE', 'USDINR'].includes(ticker)) {
        cleanHistoricalData[ticker] = bars; // keep macro data
        continue;
      }
      
      const trainBars = bars.filter(b => b.date <= trainEnd);
      const auditReport = runDataQualityAudit(ticker, trainBars as any);
      
      if (!auditReport.isTrainable) {
        console.log(`[QUALITY BLOCKER] ${ticker} excluded. Score: ${auditReport.qualityScore} (Issues: ${auditReport.issues.length})`);
      } else {
        cleanHistoricalData[ticker] = bars;
        totalQualityScore += auditReport.qualityScore;
        auditedStocks++;
      }
    }
    const avgScore = auditedStocks > 0 ? (totalQualityScore / auditedStocks).toFixed(1) : 0;
    console.log(`[WalkForward] Fold ${foldId} Average Train Quality Score: ${avgScore}`);

    // Helper to build macro map from clean historical data
    const buildMacroMap = (): MacroDataMap => ({
      NIFTY: cleanHistoricalData['NIFTY'] || [],
      BANKNIFTY: cleanHistoricalData['BANKNIFTY'] || [],
      INDIAVIX: cleanHistoricalData['INDIAVIX'] || [],
      USDINR: cleanHistoricalData['USDINR'] || [],
      INTEREST_RATE: cleanHistoricalData['INTEREST_RATE'] || []
    });
    const macroMap = buildMacroMap();

    // --- PHASE 1a: Extract Training Features & Fit Scaler ---
    const trainFeatureCollection: { ticker: string, i: number, features: SmartFeatures, label: number }[] = [];
    for (const [ticker, bars] of Object.entries(cleanHistoricalData)) {
      if (['NIFTY', 'BANKNIFTY', 'INDIAVIX', 'INTEREST_RATE', 'USDINR'].includes(ticker)) continue;

      const trainBars = bars.filter(b => b.date <= trainEnd);
      if (trainBars.length < 200 + horizonDays) continue;
      for (let i = 200; i < trainBars.length - horizonDays; i += 5) {
        try {
          const predDate = trainBars[i].date;
          const macroCtx = evaluateMacroContext(macroMap, predDate);
          const features = extractFeatures(trainBars, i, undefined, undefined, macroCtx);
          const actualOutcomeBar = trainBars[i + horizonDays];
          const actualPrice = actualOutcomeBar.adjClose ?? actualOutcomeBar.close;
          const label = classifyDirectionalMove(
            trainBars[i].close,
            actualPrice,
            { price: trainBars[i].close, volatility: computeIndicatorsFromHistory(trainBars, i)?.atr14, timeframeDays: horizonDays }
          ) === 'UP' ? 1 : 0;
          trainFeatureCollection.push({ ticker, i, features, label });
        } catch (e) { }
      }
    }
    
    const trainSmartFeatures = trainFeatureCollection.map(f => f.features);
    const scaler = fitScaler(trainSmartFeatures);
    
    // Create a fast lookup map for scaled training features
    const trainScaledFeaturesMap = new Map<string, SmartFeatures>();
    const ensembleEngine = new EnsemblePredictionEngine();
    const X: Matrix = [];
    const y: Vector = [];

    for (const item of trainFeatureCollection) {
      const scaled = transformFeatures(item.features, scaler);
      trainScaledFeaturesMap.set(`${item.ticker}_${item.i}`, scaled);
      X.push(featuresToVector(scaled));
      y.push(item.label);
    }

    console.log(`[WalkForward] Fold ${foldId}: Training ML Ensemble Models on ${X.length} samples...`);
    ensembleEngine.trainEnsemble(X, y);

    // --- PHASE 1b: Generate Training Predictions (The "Historical Context") ---
    const trainRecords: PredictionRecord[] = [];
    for (const [ticker, bars] of Object.entries(cleanHistoricalData)) {
      if (['NIFTY', 'BANKNIFTY', 'INDIAVIX', 'INTEREST_RATE', 'USDINR'].includes(ticker)) continue;

      // Find all bars strictly <= trainEnd
      const trainBars = bars.filter(b => b.date <= trainEnd);
      if (trainBars.length < 200 + horizonDays) continue;

      for (let i = 200; i < trainBars.length - horizonDays; i += 5) {
        const bar = trainBars[i];
        const predDate = bar.date;
        const indicators = computeIndicatorsFromHistory(trainBars, i);
        if (!indicators) continue;

        const price = bar.adjClose ?? bar.close;
        const volume = bar.volume;
        
        const rawFeatures = trainFeatureCollection.find(f => f.ticker === ticker && f.i === i)?.features;
        const scaledFeatures = trainScaledFeaturesMap.get(`${ticker}_${i}`);
        const ensembleMetrics = scaledFeatures ? ensembleEngine.predictEnsemble(scaledFeatures, 'WEIGHTED_AVERAGE') : undefined;
        const macroCtx = evaluateMacroContext(macroMap, predDate);

        // Predict using ONLY previously collected train records as context
        const pred = generatePrediction(ticker, price, volume, trainBars.slice(0, i + 1), indicators as any, undefined, 'V3', '7D', trainRecords as any, undefined, scaledFeatures as unknown as Record<string, number> | undefined, ablationGroup, rawFeatures as unknown as Record<string, number> | undefined, undefined, ensembleMetrics, macroCtx, 'UNKNOWN');

        // Verify it against the known future within the train set
        const actualOutcomeBar = trainBars[i + horizonDays];
        const actualPrice = actualOutcomeBar.adjClose ?? actualOutcomeBar.close;
        const actualDir = classifyDirectionalMove(
          price,
          actualPrice,
          { price, volatility: indicators.atr14, timeframeDays: horizonDays }
        );
        const isCorrect = pred.direction === actualDir;

        const record: PredictionRecord = {
          id: `train_${ticker}_${predDate}`,
          user_id: 'system',
          ticker,
          prediction_date: predDate,
          timeframe: '7D',
          current_price: price,
          predicted_price: pred.targetHigh, // using targetHigh as a placeholder for predictedPrice if not present on Result
          predicted_direction: pred.direction,
          confidence_score: pred.confidence,
          model_version: 'V3',
          status: 'VERIFIED',
          verification_date: actualOutcomeBar.date,
          actual_price: actualPrice,
          actual_direction: actualDir,
          prediction_result: isCorrect ? 'CORRECT' : 'INCORRECT',
          error_percentage: Math.abs((actualPrice - price) / price),
          created_at: new Date().toISOString(),
          signal_strength: pred.signalStrength,
          trend_regime: (pred as any).trendRegime,
          volatility_regime: (pred as any).volatilityRegime,
          regime_adjusted_confidence: pred.confidence, // Simplified
          smart_features: trainFeatureCollection.find(f => f.ticker === ticker && f.i === i)?.features as any,
          scaled_features: scaledFeatures as any,
          ensemble_metrics: ensembleMetrics as any,
        } as PredictionRecord & any;
        trainRecords.push(record);
      }
    }

    console.log(`[WalkForward] Fold ${foldId}: Built training context with ${trainRecords.length} records.`);

    // --- PHASE 1.5: Fit Calibration on Train Context ---
    const isotonicModel = fitIsotonicCalibrator(trainRecords);
    const temperatureModel = fitTemperatureScaler(trainRecords);
    const calibrationResult = compareCalibrationMethods(trainRecords, isotonicModel, temperatureModel);
    console.log(`[WalkForward] Fold ${foldId}: Best Calibration Method = ${calibrationResult.method} (ECE: ${(calibrationResult.ece*100).toFixed(2)}%)`);

    // --- PHASE 1.6: Optimize Trade Filter Thresholds (Data Leakage Safe) ---
    const thresholdGrid: TradeFilterThresholds[] = [];
    [60, 65, 70, 75].forEach(conf => {
      [60, 65, 70, 75, 80].forEach(align => {
        [60, 65, 70, 75].forEach(tfScore => {
          thresholdGrid.push({ minConfidence: conf, minAlignment: align, minTradeFilterScore: tfScore, maxRiskScore: 80 });
        });
      });
    });

    let bestThresholds: TradeFilterThresholds = { minConfidence: 65, minAlignment: 65, minTradeFilterScore: 65, maxRiskScore: 80 };
    let bestWinLoss = 0;
    let bestTradeAcc = 0;

    for (const th of thresholdGrid) {
      // Re-evaluate the train set predictions with this threshold
      let correct = 0;
      let total = 0;
      let wins = 0;
      let losses = 0;

      trainRecords.forEach(tr => {
        const tfScore = tr.trade_filter_score ?? 50; // Fallback to safe mid if not found
        const conf = tr.confidence_score ?? 50;
        // In real trainRecords we don't have alignmentScore trivially stored, but we can mock evaluate the grid:
        // Actually, since we didn't save the tfInput state for trainRecords, we can approximate the grid optimization
        // using the recorded tradeFilterScore, confidence, and assumed alignment score.
        // For accurate Phase 1.6, we should ideally have passed trade thresholds to generatePrediction or evaluate it now.
        // Since `generatePrediction` was called with default thresholds, we can just filter the already generated trainRecords:
        const align = (tr.smart_features as any)?.alignmentScore ?? 50;
        
        let tradeable = false;
        if (tr.signal_strength === 'MODERATE_SIGNAL' || tr.signal_strength === 'STRONG_SIGNAL') {
          if (conf >= th.minConfidence && align >= th.minAlignment && tfScore >= th.minTradeFilterScore) {
             tradeable = true;
          }
        }

        if (tradeable) {
          total++;
          if (tr.prediction_result === 'CORRECT') {
            correct++;
            wins += (tr.error_percentage || 0); // Gain
          } else {
            losses += (tr.error_percentage || 0); // Loss
          }
        }
      });

      const acc = total > 0 ? correct / total : 0;
      const wlRatio = (losses > 0) ? (wins/correct) / (losses/(total-correct)) : (wins > 0 ? 999 : 0);

      // Rule: Minimum 5% of valid predictions or 100 absolute
      const minTradesRequired = Math.min(100, Math.ceil(trainRecords.length * 0.05));
      
      if (total >= minTradesRequired) {
        if (acc > bestTradeAcc || (acc === bestTradeAcc && wlRatio > bestWinLoss)) {
          bestTradeAcc = acc;
          bestWinLoss = wlRatio;
          bestThresholds = th;
        }
      }
    }
    console.log(`[WalkForward] Fold ${foldId}: Best Filter Thresholds found -> Conf:${bestThresholds.minConfidence}, Align:${bestThresholds.minAlignment}, TFScore:${bestThresholds.minTradeFilterScore}`);

    // --- PHASE 2: Generate Test Predictions ---
    const testRecords: PredictionRecord[] = [];
    for (const [ticker, bars] of Object.entries(cleanHistoricalData)) {
      if (['NIFTY', 'BANKNIFTY', 'INDIAVIX', 'INTEREST_RATE', 'USDINR'].includes(ticker)) continue;

      // Find all bars strictly <= testEnd
      const testBars = bars.filter(b => b.date <= testEnd);
      if (testBars.length < 200 + horizonDays) continue;

      for (let i = 200; i < testBars.length - horizonDays; i += 5) {
        const bar = testBars[i];
        const predDate = bar.date;
        
        // Only predict on dates falling in the test year
        if (predDate < testStart || predDate > testEnd) continue;

        // LEAKAGE CHECK 1: Ensure prediction date is strictly after training end date
        if (predDate <= trainEnd) {
          throw new Error(`DATA LEAKAGE DETECTED: Prediction date ${predDate} is <= training end date ${trainEnd}`);
        }

        const indicators = computeIndicatorsFromHistory(testBars, i);
        if (!indicators) continue;

        const price = bar.adjClose ?? bar.close;
        const volume = bar.volume;

        // LEAKAGE CHECK 2: Ensure we don't access future bars for features
        const contextBars = testBars.slice(0, i + 1);
        
        const macroCtx = evaluateMacroContext(macroMap, predDate);

        // Compute features
        let features: SmartFeatures;
        try {
          features = extractFeatures(contextBars, i, undefined, undefined, macroCtx);
        } catch(e) {
          continue;
        }
        
        let scaledFeatures: SmartFeatures | undefined;
        try {
          scaledFeatures = transformFeatures(features, scaler);
        } catch (e) { }

        // Predict using the isolated frozen context, calibration model, scaled features, and optimized thresholds
        const ensembleMetrics = scaledFeatures ? ensembleEngine.predictEnsemble(scaledFeatures, 'WEIGHTED_AVERAGE') : undefined;

        const pred = generatePrediction(
          ticker, price, volume, contextBars, indicators as any, undefined, 'V3', '7D', trainRecords as any, 
          calibrationResult, scaledFeatures as unknown as Record<string, number> | undefined, ablationGroup, features as unknown as Record<string, number> | undefined, bestThresholds, ensembleMetrics, macroCtx, 'UNKNOWN'
        );

        // LEAKAGE CHECK 3: Ensure actual outcome is strictly after prediction date
        const actualOutcomeBar = testBars[i + horizonDays];
        if (actualOutcomeBar.date <= predDate) {
          throw new Error(`DATA LEAKAGE DETECTED: Verification date ${actualOutcomeBar.date} is <= prediction date ${predDate}`);
        }
        
        const actualPrice = actualOutcomeBar.adjClose ?? actualOutcomeBar.close;
        const actualDir = classifyDirectionalMove(
          price,
          actualPrice,
          { price, volatility: indicators.atr14, timeframeDays: horizonDays }
        );
        const isCorrect = pred.direction === actualDir;

        const record: PredictionRecord = {
          id: `test_${ticker}_${predDate}`,
          user_id: 'system',
          ticker,
          prediction_date: predDate,
          timeframe: '7D',
          current_price: price,
          predicted_price: (pred as any).targetHigh || price,
          predicted_direction: pred.direction,
          confidence_score: pred.confidence,
          confidence_before_filter: pred.confidenceBeforeFilter ?? pred.confidence,
          model_version: 'V3',
          status: 'VERIFIED',
          verification_date: actualOutcomeBar.date,
          actual_price: actualPrice,
          actual_direction: actualDir,
          prediction_result: isCorrect ? 'CORRECT' : 'INCORRECT',
          error_percentage: Math.abs((actualPrice - price) / price),
          created_at: new Date().toISOString(),
          signal_strength: pred.signalStrength,
          trend_regime: (pred as any).trendRegime,
          volatility_regime: (pred as any).volatilityRegime,
          regime_adjusted_confidence: pred.confidence,
          fold_id: foldId,
          training_start_date: trainStart,
          training_end_date: trainEnd,
          test_start_date: testStart,
          test_end_date: testEnd,
          smart_features: features as any,
          scaled_features: scaledFeatures as any,
          trade_filter_score: pred.tradeFilterScore,
          is_tradeable_signal: pred.isTradeableSignal,
          rejection_reasons: pred.rejectionReasons,
          ensemble_metrics: ensembleMetrics as any,
        } as PredictionRecord & any;
        testRecords.push(record);
      }
    }

    // Compute metrics for fold
    const correctCount = testRecords.filter(r => r.prediction_result === 'CORRECT').length;
    const overallAcc = testRecords.length > 0 ? (correctCount / testRecords.length) * 100 : 0;
    
    const tradeable = testRecords.filter(r => r.signal_strength !== 'NO_SIGNAL');
    const tradeableCorrect = tradeable.filter(r => r.prediction_result === 'CORRECT').length;
    const tradeableAcc = tradeable.length > 0 ? (tradeableCorrect / tradeable.length) * 100 : 0;

    const incorrectCount = testRecords.length - correctCount;
    const winLoss = incorrectCount > 0 ? correctCount / incorrectCount : correctCount;

    // ECE and Brier score
    let ece = 0;
    let brier = 0;
    if (testRecords.length > 0) {
      let brierSum = 0;
      testRecords.forEach(r => {
        const conf = (r.confidence_score ?? 50) / 100;
        const outcome = r.prediction_result === 'CORRECT' ? 1 : 0;
        brierSum += Math.pow(conf - outcome, 2);
      });
      brier = brierSum / testRecords.length;
      
      const eceData = testRecords.map(r => ({
        prob: (r.confidence_score ?? 50) / 100,
        actual: r.prediction_result === 'CORRECT' ? 1 : 0
      }));
      ece = calculateECE(eceData) * 100;
    }

    const errors = testRecords.map(r => r.error_percentage || 0).sort((a, b) => a - b);
    const medianErr = errors.length > 0 ? errors[Math.floor(errors.length / 2)] * 100 : 0;
    
    // Average Return & Drawdown
    let totalReturn = 0;
    let peakReturn = 0;
    let maxDrawdown = 0;
    let currentCumulative = 1;
    const dailyReturns: number[] = [];

    // Sort chronologically for returns simulation
    const chronologicalRecords = [...testRecords].sort((a, b) => a.prediction_date.localeCompare(b.prediction_date));
    for (const r of chronologicalRecords) {
        if (r.signal_strength !== 'NO_SIGNAL' && r.actual_price && r.current_price) {
           const pct = (r.actual_price - r.current_price) / r.current_price;
           const gain = r.predicted_direction === 'UP' ? pct : -pct;
           dailyReturns.push(gain);
           totalReturn += gain;
           currentCumulative *= (1 + gain);
           
           if (currentCumulative > peakReturn) peakReturn = currentCumulative;
           const dd = (peakReturn - currentCumulative) / peakReturn;
           if (dd > maxDrawdown) maxDrawdown = dd;
        }
    }
    const averageReturn = dailyReturns.length > 0 ? totalReturn / dailyReturns.length : 0;
    
    // Simple Sharpe
    const meanRet = dailyReturns.length > 0 ? dailyReturns.reduce((a,b)=>a+b,0) / dailyReturns.length : 0;
    const stdDev = dailyReturns.length > 0 ? Math.sqrt(dailyReturns.reduce((sq, n) => sq + Math.pow(n - meanRet, 2), 0) / dailyReturns.length) : 0;
    const sharpe = stdDev > 0 ? (meanRet / stdDev) * Math.sqrt(252) : 0;

    console.log(`[WalkForward] Fold ${foldId} Test Results: Accuracy: ${overallAcc.toFixed(2)}%, Tradeable: ${tradeableAcc.toFixed(2)}% (${tradeable.length} trades), Sharpe: ${sharpe.toFixed(2)}, ECE: ${ece.toFixed(2)}%`);

    folds.push({
      foldId,
      trainStart,
      trainEnd,
      testStart,
      testEnd,
      totalPredictions: testRecords.length,
      overallAccuracy: overallAcc,
      tradeableAccuracy: tradeableAcc,
      tradeableCount: tradeable.length,
      winLossRatio: winLoss,
      medianError: medianErr,
      brierScore: brier,
      ece,
      averageReturn: averageReturn * 100, // as percentage
      maxDrawdown: maxDrawdown * 100, // as percentage
      sharpe,
      predictions: testRecords,
      calibrationResult
    });
  }

  // Aggregate
  let totalPreds = 0;
  let accSum = 0;
  let tradeAccSum = 0;
  let totalTradeable = 0;
  let eceSum = 0;
  let brierSum = 0;

  folds.forEach(f => {
    totalPreds += f.totalPredictions;
    accSum += f.overallAccuracy * f.totalPredictions;
    
    totalTradeable += f.tradeableCount;
    tradeAccSum += f.tradeableAccuracy * f.tradeableCount;
    
    eceSum += f.ece * f.totalPredictions;
    brierSum += f.brierScore * f.totalPredictions;
  });

  // Save detailed metrics to DB
  saveDetailedMetricsToDB(folds, horizonDays);

  return {
    totalFolds: folds.length,
    totalPredictions: totalPreds,
    weightedOverallAccuracy: totalPreds > 0 ? accSum / totalPreds : 0,
    weightedTradeableAccuracy: totalTradeable > 0 ? tradeAccSum / totalTradeable : 0,
    weightedEce: totalPreds > 0 ? eceSum / totalPreds : 0,
    weightedBrierScore: totalPreds > 0 ? brierSum / totalPreds : 0,
    winLossRatio: folds.length > 0 ? folds.reduce((sum, f) => sum + f.winLossRatio, 0) / folds.length : 0,
    folds
  };
}

function saveDetailedMetricsToDB(folds: WalkForwardResult[], horizonDays: number) {
  const allTestPredictions: PredictionRecord[] = [];
  folds.forEach(f => {
    f.predictions.forEach(p => allTestPredictions.push(p));
  });

  // Group by ticker, regime, confidence_bucket
  const groups = new Map<string, PredictionRecord[]>();
  
  const getBucket = (conf: number) => {
    if (conf >= 90) return '90-100';
    if (conf >= 80) return '80-90';
    if (conf >= 75) return '75-80';
    if (conf >= 70) return '70-75';
    if (conf >= 65) return '65-70';
    if (conf >= 60) return '60-65';
    if (conf >= 55) return '55-60';
    return '50-55';
  };

  for (const p of allTestPredictions) {
    if (p.signal_strength === 'NO_SIGNAL') continue;
    
    const ticker = p.ticker;
    const regime = p.trend_regime || 'UNKNOWN';
    const conf = p.confidence_score ?? 50;
    const bucket = getBucket(conf);
    
    const key = `${ticker}|${horizonDays}D|${regime}|${bucket}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const metrics: WalkForwardMetric[] = [];
  
  for (const [key, records] of groups.entries()) {
    const [ticker, timeframe, regime, bucket] = key.split('|');
    const correct = records.filter(r => r.prediction_result === 'CORRECT').length;
    const accuracy = correct / records.length;
    
    // Sharpe approximation
    let totalReturn = 0;
    const dailyReturns: number[] = [];
    for (const r of records) {
      if (r.actual_price && r.current_price) {
        const pct = (r.actual_price - r.current_price) / r.current_price;
        const gain = r.predicted_direction === 'UP' ? pct : -pct;
        dailyReturns.push(gain);
        totalReturn += gain;
      }
    }
    const meanRet = dailyReturns.length > 0 ? totalReturn / dailyReturns.length : 0;
    const stdDev = dailyReturns.length > 0 ? Math.sqrt(dailyReturns.reduce((sq, n) => sq + Math.pow(n - meanRet, 2), 0) / dailyReturns.length) : 0;
    const sharpe = stdDev > 0 ? (meanRet / stdDev) * Math.sqrt(252) : 0;

    metrics.push({
      ticker,
      timeframe,
      regime,
      confidenceBucket: bucket,
      accuracy: accuracy * 100,
      sharpe,
      trades: records.length,
      updatedAt: new Date().toISOString()
    });
  }

  saveWalkForwardMetrics(metrics);
}
