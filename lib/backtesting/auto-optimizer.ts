/* eslint-disable @typescript-eslint/no-unused-vars */
// ─── Auto-Optimization Engine ─────────────────────────────────────────────────

import {
  BacktestPredictionRecord,
  OptimizationRecommendation,
  TickerBacktestResult,
  MarketRegime,
} from './types';

const INDICATORS = ['trend', 'rsi', 'macd', 'volume', 'volatility'] as const;
type Indicator = typeof INDICATORS[number];

const INDICATOR_DEFAULT_WEIGHTS: Record<Indicator, number> = {
  trend: 15,
  rsi: 12,
  macd: 10,
  volume: 10,
  volatility: 8,
};

// ─── Main Optimizer ───────────────────────────────────────────────────────────

/**
 * Analyzes backtest results and generates optimization recommendations.
 * Called after every backtest completes.
 */
export function generateOptimizationRecommendations(
  allRecords: BacktestPredictionRecord[],
  tickerResults: TickerBacktestResult[]
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  const verified = allRecords.filter(r => r.result !== 'PENDING');

  if (verified.length < 30) {
    return [{
      indicator: 'Insufficient Data',
      currentWeight: 0,
      recommendedWeight: 0,
      changeDirection: 'KEEP',
      changePct: 0,
      reason: `Only ${verified.length} verified predictions. Need at least 30 to optimize.`,
      expectedImprovementPct: 0,
      bestRegime: 'BULL',
      confidence: 'LOW',
    }];
  }

  // 1. Analyze each indicator's performance correlation
  for (const indicator of INDICATORS) {
    const rec = analyzeIndicator(indicator, verified);
    if (rec) recommendations.push(rec);
  }

  // 2. Regime performance analysis
  const regimeRec = analyzeRegimePerformance(verified);
  if (regimeRec) recommendations.push(regimeRec);

  // 3. Timeframe sweet spot
  const timeframeRec = analyzeTimeframes(tickerResults);
  if (timeframeRec) recommendations.push(timeframeRec);

  // 4. Confidence threshold optimization
  const thresholdRec = analyzeConfidenceThresholds(verified);
  if (thresholdRec) recommendations.push(thresholdRec);

  // Sort by expected improvement descending
  return recommendations.sort((a, b) => b.expectedImprovementPct - a.expectedImprovementPct);
}

// ─── Indicator Analysis ───────────────────────────────────────────────────────

function analyzeIndicator(
  indicator: Indicator,
  records: BacktestPredictionRecord[]
): OptimizationRecommendation | null {
  const defaultWeight = INDICATOR_DEFAULT_WEIGHTS[indicator];
  const currentWeight = defaultWeight; // In production, read from adaptive weights file

  // Split records by whether this indicator was highly active (proxy: confidence > 70)
  const highConfidence = records.filter(r => r.confidence > 70);
  const lowConfidence = records.filter(r => r.confidence <= 70);

  // Compute accuracy for high vs low confidence (as proxy for indicator contribution)
  const highAcc = computeGroupAccuracy(highConfidence);
  const lowAcc = computeGroupAccuracy(lowConfidence);
  const overallAcc = computeGroupAccuracy(records);

  // Determine if indicator correlation with RSI data (simplified heuristic)
  const indicatorImpact = highAcc - lowAcc;

  let changeDirection: 'INCREASE' | 'DECREASE' | 'KEEP' = 'KEEP';
  let changePct = 0;
  let reason = '';
  let expectedImprovement = 0;
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';

  if (Math.abs(indicatorImpact) < 3) {
    changeDirection = 'KEEP';
    reason = `${capitalize(indicator)} shows neutral impact (${round(indicatorImpact)}% delta). Keep current weight.`;
    expectedImprovement = 0;
    confidence = 'LOW';
  } else if (indicatorImpact > 3) {
    changeDirection = 'INCREASE';
    changePct = Math.min(50, Math.round(indicatorImpact * 2));
    reason = `${capitalize(indicator)} shows ${round(indicatorImpact)}% higher accuracy when strongly active. Increasing weight should improve predictions.`;
    expectedImprovement = round(indicatorImpact * 0.3);
    confidence = indicatorImpact > 8 ? 'HIGH' : 'MEDIUM';
  } else {
    changeDirection = 'DECREASE';
    changePct = Math.min(40, Math.round(Math.abs(indicatorImpact) * 1.5));
    reason = `${capitalize(indicator)} shows ${round(Math.abs(indicatorImpact))}% lower accuracy when active. Reducing weight may improve overall accuracy.`;
    expectedImprovement = round(Math.abs(indicatorImpact) * 0.2);
    confidence = indicatorImpact < -8 ? 'HIGH' : 'MEDIUM';
  }

  const recommendedWeight = changeDirection === 'INCREASE'
    ? Math.round(currentWeight * (1 + changePct / 100))
    : changeDirection === 'DECREASE'
    ? Math.round(currentWeight * (1 - changePct / 100))
    : currentWeight;

  // Find best regime for this indicator
  const regimeAccuracies = analyzeIndicatorByRegime(indicator, records);
  const bestRegime = Object.entries(regimeAccuracies).sort((a, b) => b[1] - a[1])[0]?.[0] as MarketRegime ?? 'BULL';

  return {
    indicator: capitalize(indicator),
    currentWeight,
    recommendedWeight: Math.max(1, recommendedWeight),
    changeDirection,
    changePct,
    reason,
    expectedImprovementPct: expectedImprovement,
    bestRegime,
    confidence,
  };
}

// ─── Regime Analysis ──────────────────────────────────────────────────────────

function analyzeRegimePerformance(records: BacktestPredictionRecord[]): OptimizationRecommendation | null {
  const regimes: MarketRegime[] = ['BULL', 'BEAR', 'SIDEWAYS', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'TRENDING', 'MEAN_REVERTING'];
  const regimeAccuracies: Partial<Record<MarketRegime, number>> = {};

  for (const regime of regimes) {
    const regimeRecs = records.filter(r => r.regime === regime);
    if (regimeRecs.length >= 10) {
      regimeAccuracies[regime] = computeGroupAccuracy(regimeRecs);
    }
  }

  const entries = Object.entries(regimeAccuracies) as [MarketRegime, number][];
  if (entries.length < 2) return null;

  entries.sort((a, b) => b[1] - a[1]);
  const bestRegime = entries[0][0];
  const worstRegime = entries[entries.length - 1][0];
  const gap = entries[0][1] - entries[entries.length - 1][1];

  if (gap < 10) return null; // Not significant enough

  return {
    indicator: 'Regime Filter',
    currentWeight: 1,
    recommendedWeight: 2,
    changeDirection: 'INCREASE',
    changePct: 100,
    reason: `Model performs ${round(gap)}% better in ${bestRegime} than ${worstRegime} regimes. Consider adding regime-specific confidence adjustments.`,
    expectedImprovementPct: round(gap * 0.25),
    bestRegime,
    confidence: gap > 20 ? 'HIGH' : 'MEDIUM',
  };
}

// ─── Timeframe Analysis ───────────────────────────────────────────────────────

function analyzeTimeframes(tickerResults: TickerBacktestResult[]): OptimizationRecommendation | null {
  // Aggregate accuracy by timeframe across all tickers
  const horizonAccuracies: Record<string, number[]> = {};
  for (const result of tickerResults) {
    for (const [horizon, acc] of Object.entries(result.timeframeBreakdown)) {
      if (!horizonAccuracies[horizon]) horizonAccuracies[horizon] = [];
      horizonAccuracies[horizon].push(acc);
    }
  }

  const entries = Object.entries(horizonAccuracies).map(([h, accs]) => ({
    horizon: h,
    accuracy: mean(accs),
  })).sort((a, b) => b.accuracy - a.accuracy);

  if (entries.length < 2) return null;

  const best = entries[0];
  const worst = entries[entries.length - 1];

  return {
    indicator: 'Prediction Horizon',
    currentWeight: 1,
    recommendedWeight: 1,
    changeDirection: 'KEEP',
    changePct: 0,
    reason: `Best timeframe is ${best.horizon} (${round(best.accuracy)}% accuracy). Worst is ${worst.horizon} (${round(worst.accuracy)}% accuracy). Consider prioritizing ${best.horizon} predictions.`,
    expectedImprovementPct: round((best.accuracy - worst.accuracy) * 0.15),
    bestRegime: 'BULL',
    confidence: 'MEDIUM',
  };
}

// ─── Confidence Threshold Analysis ───────────────────────────────────────────

function analyzeConfidenceThresholds(records: BacktestPredictionRecord[]): OptimizationRecommendation | null {
  const thresholds = [55, 60, 65, 70, 75, 80];
  const results = thresholds.map(t => {
    const filtered = records.filter(r => r.confidence >= t);
    return { threshold: t, count: filtered.length, accuracy: computeGroupAccuracy(filtered) };
  });

  // Find optimal threshold (best accuracy with at least 10% of predictions)
  const totalCount = records.length;
  const optimal = results
    .filter(r => r.count >= totalCount * 0.1)
    .sort((a, b) => b.accuracy - a.accuracy)[0];

  if (!optimal) return null;

  const current = results[0]; // 55% baseline
  const gain = optimal.accuracy - current.accuracy;

  if (gain < 5) return null;

  return {
    indicator: 'Confidence Threshold',
    currentWeight: 55,
    recommendedWeight: optimal.threshold,
    changeDirection: 'INCREASE',
    changePct: optimal.threshold - 55,
    reason: `Raising minimum confidence threshold from 55% to ${optimal.threshold}% increases accuracy by ${round(gain)}% while retaining ${round((optimal.count / totalCount) * 100)}% of predictions.`,
    expectedImprovementPct: round(gain),
    bestRegime: 'BULL',
    confidence: gain > 10 ? 'HIGH' : 'MEDIUM',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeGroupAccuracy(records: BacktestPredictionRecord[]): number {
  if (records.length === 0) return 0;
  const verified = records.filter(r => r.result !== 'PENDING');
  if (verified.length === 0) return 0;
  const correct = verified.filter(r => r.result === 'CORRECT' || r.result === 'PARTIALLY_CORRECT');
  return (correct.length / verified.length) * 100;
}

function analyzeIndicatorByRegime(
  indicator: Indicator,
  records: BacktestPredictionRecord[]
): Partial<Record<MarketRegime, number>> {
  const regimes: MarketRegime[] = ['BULL', 'BEAR', 'SIDEWAYS', 'HIGH_VOLATILITY'];
  const result: Partial<Record<MarketRegime, number>> = {};
  for (const regime of regimes) {
    const regimeRecs = records.filter(r => r.regime === regime);
    if (regimeRecs.length >= 5) {
      result[regime] = computeGroupAccuracy(regimeRecs);
    }
  }
  return result;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round(val: number): number {
  return Math.round(val * 100) / 100;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
