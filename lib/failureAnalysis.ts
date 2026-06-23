import { PredictionRecord, getSector } from './predictions-db';
import { calculateECE } from './confidenceCalibration';

export type FailureReason = 
  | 'WRONG_REGIME'
  | 'TIMEFRAME_CONFLICT'
  | 'OVERCONFIDENT_SIGNAL'
  | 'HIGH_VOLATILITY_FAILURE'
  | 'LOW_VOLUME_FAILURE'
  | 'AGAINST_MARKET_TREND'
  | 'SECTOR_WEAKNESS'
  | 'POOR_FEATURE_SIGNAL'
  | 'PRICE_GAP_EVENT'
  | 'UNKNOWN_REASON';

export interface AggregateMetrics {
  key: string;
  totalPredictions: number;
  correctPredictions: number;
  wrongPredictions: number;
  accuracy: number;
  tradeableCount: number;
  tradeableAccuracy: number;
  averageConfidence: number;
  calibrationGap: number;
  medianError: number;
  winLossRatio: number;
  brierScore: number;
  ece: number;
  sampleSizeWarning: boolean;
  recommendation?: string;
  bestItem?: string; // used for sector/timeframe to identify best sub-item
  worstItem?: string;
}

export interface FailureAnalysisReport {
  stocks: AggregateMetrics[];
  sectors: AggregateMetrics[];
  trendRegimes: AggregateMetrics[];
  volatilityRegimes: AggregateMetrics[];
  combinedRegimes: AggregateMetrics[];
  timeframes: AggregateMetrics[];
  confidenceBuckets: AggregateMetrics[];
  signalTypes: AggregateMetrics[];
  topFailureReasons: Record<FailureReason, number>;
}

// Helpers
function calculateWLRatio(predictions: PredictionRecord[]): number {
  let winSum = 0;
  let winCount = 0;
  let lossSum = 0;
  let lossCount = 0;
  
  predictions.forEach(p => {
    if (p.prediction_result === 'CORRECT') {
      winSum += (p.error_percentage || 0);
      winCount++;
    } else {
      lossSum += (p.error_percentage || 0);
      lossCount++;
    }
  });
  
  if (lossCount === 0 || lossSum === 0) return winCount > 0 ? 999 : 0;
  if (winCount === 0 || winSum === 0) return 0;
  
  const avgWin = winSum / winCount;
  const avgLoss = lossSum / lossCount;
  return avgWin / avgLoss;
}

function calculateMedianError(predictions: PredictionRecord[]): number {
  const errors = predictions.map(r => r.error_percentage || 0).sort((a, b) => a - b);
  return errors.length > 0 ? errors[Math.floor(errors.length / 2)] * 100 : 0;
}

function calculateBrierScore(predictions: PredictionRecord[]): number {
  if (predictions.length === 0) return 0;
  let brierSum = 0;
  predictions.forEach(p => {
    const conf = (p.confidence_score ?? 50) / 100;
    const outcome = p.prediction_result === 'CORRECT' ? 1 : 0;
    brierSum += Math.pow(conf - outcome, 2);
  });
  return brierSum / predictions.length;
}

function computeMetricsForGroup(key: string, predictions: PredictionRecord[], minSampleSize: number): AggregateMetrics {
  const total = predictions.length;
  const correct = predictions.filter(p => p.prediction_result === 'CORRECT').length;
  const wrong = total - correct;
  const accuracy = total > 0 ? (correct / total) * 100 : 0;

  const tradeable = predictions.filter(p => p.is_tradeable_signal === true);
  const tradeableCount = tradeable.length;
  const tradeableCorrect = tradeable.filter(p => p.prediction_result === 'CORRECT').length;
  const tradeableAccuracy = tradeableCount > 0 ? (tradeableCorrect / tradeableCount) * 100 : 0;

  const avgConf = total > 0 ? predictions.reduce((sum, p) => sum + (p.confidence_score ?? 50), 0) / total : 0;
  const calibrationGap = avgConf - accuracy;

  const winLossRatio = calculateWLRatio(predictions);
  const medianError = calculateMedianError(predictions);
  const brierScore = calculateBrierScore(predictions);

  const eceData = predictions.map(p => ({
    prob: (p.confidence_score ?? 50) / 100,
    actual: p.prediction_result === 'CORRECT' ? 1 : 0
  }));
  const ece = eceData.length > 0 ? calculateECE(eceData) * 100 : 0;

  return {
    key,
    totalPredictions: total,
    correctPredictions: correct,
    wrongPredictions: wrong,
    accuracy,
    tradeableCount,
    tradeableAccuracy,
    averageConfidence: avgConf,
    calibrationGap,
    medianError,
    winLossRatio,
    brierScore,
    ece,
    sampleSizeWarning: total < minSampleSize
  };
}

export function tagFailureReasons(record: PredictionRecord): FailureReason[] {
  const reasons: FailureReason[] = [];
  if (record.prediction_result !== 'INCORRECT') return reasons;

  // Evaluate tags
  const conf = record.confidence_score ?? 50;
  if (conf > 80) reasons.push('OVERCONFIDENT_SIGNAL');
  
  if (record.volatility_regime === 'HIGH_VOLATILITY') reasons.push('HIGH_VOLATILITY_FAILURE');
  
  // A crude timeframe conflict check based on signal strength vs confidence, 
  // or if we had smart features available we could read `timeframeConflict`.
  if (record.smart_features && (record.smart_features as any).timeframeConflict) {
    reasons.push('TIMEFRAME_CONFLICT');
  }

  // Price gap event if error percentage is huge (e.g. > 10% on a short timeframe)
  if ((record.error_percentage || 0) > 0.10 && record.timeframe !== '1Y') {
    reasons.push('PRICE_GAP_EVENT');
  }

  // Add more specific logic based on market regime vs predicted direction
  if (record.trend_regime === 'BEAR_MARKET' && record.predicted_direction === 'UP') {
    reasons.push('AGAINST_MARKET_TREND');
  } else if (record.trend_regime === 'BULL_MARKET' && record.predicted_direction === 'DOWN') {
    reasons.push('AGAINST_MARKET_TREND');
  } else if (record.trend_regime === 'SIDEWAYS_MARKET') {
    reasons.push('WRONG_REGIME');
  }

  if (reasons.length === 0) {
    reasons.push('UNKNOWN_REASON');
  }

  return reasons;
}

function getConfidenceBucket(conf: number): string {
  if (conf < 55) return 'Below 55%';
  if (conf < 65) return '55–65%';
  if (conf < 75) return '65–75%';
  if (conf < 85) return '75–85%';
  return 'Above 85%';
}

export function buildFailureAnalysisReport(verifiedPredictions: PredictionRecord[]): FailureAnalysisReport {
  const groups: Record<string, Record<string, PredictionRecord[]>> = {
    stocks: {},
    sectors: {},
    trendRegimes: {},
    volatilityRegimes: {},
    combinedRegimes: {},
    timeframes: {},
    confidenceBuckets: {},
    signalTypes: {}
  };

  const topFailureReasons: Record<string, number> = {};

  for (const pred of verifiedPredictions) {
    const stock = pred.ticker;
    const sector = getSector(stock);
    const trend = pred.trend_regime || 'UNKNOWN';
    const vol = pred.volatility_regime || 'UNKNOWN';
    const combinedRegime = `${trend} + ${vol}`;
    const tf = pred.timeframe;
    const confBucket = getConfidenceBucket(pred.confidence_score ?? 50);
    const signal = pred.signal_strength || 'UNKNOWN';

    groups.stocks[stock] = groups.stocks[stock] || []; groups.stocks[stock].push(pred);
    groups.sectors[sector] = groups.sectors[sector] || []; groups.sectors[sector].push(pred);
    groups.trendRegimes[trend] = groups.trendRegimes[trend] || []; groups.trendRegimes[trend].push(pred);
    groups.volatilityRegimes[vol] = groups.volatilityRegimes[vol] || []; groups.volatilityRegimes[vol].push(pred);
    groups.combinedRegimes[combinedRegime] = groups.combinedRegimes[combinedRegime] || []; groups.combinedRegimes[combinedRegime].push(pred);
    groups.timeframes[tf] = groups.timeframes[tf] || []; groups.timeframes[tf].push(pred);
    groups.confidenceBuckets[confBucket] = groups.confidenceBuckets[confBucket] || []; groups.confidenceBuckets[confBucket].push(pred);
    groups.signalTypes[signal] = groups.signalTypes[signal] || []; groups.signalTypes[signal].push(pred);

    if (pred.prediction_result === 'INCORRECT') {
      const reasons = tagFailureReasons(pred);
      for (const r of reasons) {
        topFailureReasons[r] = (topFailureReasons[r] || 0) + 1;
      }
    }
  }

  // Convert groups to AggregateMetrics
  const mapGroup = (groupMap: Record<string, PredictionRecord[]>, minSize: number) => {
    return Object.entries(groupMap).map(([key, preds]) => computeMetricsForGroup(key, preds, minSize));
  };

  const stocks = mapGroup(groups.stocks, 50);
  const sectors = mapGroup(groups.sectors, 100);
  const trendRegimes = mapGroup(groups.trendRegimes, 100);
  const volatilityRegimes = mapGroup(groups.volatilityRegimes, 100);
  const combinedRegimes = mapGroup(groups.combinedRegimes, 100);
  const timeframes = mapGroup(groups.timeframes, 100);
  const confidenceBuckets = mapGroup(groups.confidenceBuckets, 100);
  const signalTypes = mapGroup(groups.signalTypes, 100);

  // Generate Recommendations
  sectors.forEach(s => {
    if (!s.sampleSizeWarning && s.accuracy < 50) {
      s.recommendation = `Reduce confidence or avoid strong signals in ${s.key} sector until performance improves.`;
    }
  });

  trendRegimes.forEach(r => {
    if (!r.sampleSizeWarning && r.accuracy < 50) {
      r.recommendation = `Downgrade signals during ${r.key} markets. Accuracy is critically low.`;
    }
  });

  confidenceBuckets.forEach(b => {
    if (!b.sampleSizeWarning && b.key === 'Above 85%' && b.accuracy < 75) {
      b.recommendation = `Model is overconfident in high-confidence predictions (Gap: ${b.calibrationGap.toFixed(1)}%). Calibration needs adjustment.`;
    }
  });

  return {
    stocks,
    sectors,
    trendRegimes,
    volatilityRegimes,
    combinedRegimes,
    timeframes,
    confidenceBuckets,
    signalTypes,
    topFailureReasons: topFailureReasons as Record<FailureReason, number>
  };
}
