import { PredictionsDbService, PredictionRecord } from './predictions-db';

/**
 * Adaptive Weight Engine
 * 
 * Analyzes verified predictions to compute per-indicator performance metrics
 * and dynamically adjust prediction engine weights based on historical accuracy.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IndicatorPerformance {
  indicator_name: string;
  current_weight: number;
  previous_weight: number;
  accuracy_score: number;       // % of correct predictions when this indicator was active
  reliability_score: number;    // consistency of accuracy across time windows
  confidence_score: number;     // statistical significance factor
  success_contribution: number; // count of CORRECT outcomes when active
  failure_contribution: number; // count of INCORRECT outcomes when active
  total_activations: number;    // total times this indicator was active
  partial_contribution: number;
  contribution_score: number;
  data_status: 'RELIABLE' | 'UNRELIABLE' | 'INSUFFICIENT_VERIFIED_DATA';
  correlation_correct: number;  // correlation with correct predictions
  correlation_incorrect: number;
  last_updated: string;
}

export interface AdaptiveWeights {
  // Trend weights
  weightSma200: number;
  weightSma50: number;
  weightSma20: number;
  weightEmaCross: number;
  // Momentum weights
  weightRsiBullish: number;
  penaltyRsiOversold: number;
  penaltyRsiOverbought: number;
  weightMacd: number;
  weightStochastic: number;
  weightWilliamsR: number;
  // Volatility weights
  weightBbandMiddle: number;
  weightBbandUpper: number;
  // Volume
  weightVolume: number;
  // Thresholds
  upThreshold: number;
  downThreshold: number;
}

export interface WeightSnapshot {
  timestamp: string;
  weights: AdaptiveWeights;
  accuracyAtTime: number;
  verifiedCount: number;
  indicatorPerformance: IndicatorPerformance[];
}

// ─── Default weights (same as DEFAULT_TUNING_CONFIG) ─────────────────────────

const DEFAULT_WEIGHTS: AdaptiveWeights = {
  weightSma200: 15,
  weightSma50: 10,
  weightSma20: 8,
  weightEmaCross: 7,
  weightRsiBullish: 12,
  penaltyRsiOversold: -15,
  penaltyRsiOverbought: -10,
  weightMacd: 10,
  weightStochastic: 8,
  weightWilliamsR: 5,
  weightBbandMiddle: 8,
  weightBbandUpper: 7,
  weightVolume: 10,
  upThreshold: 55,
  downThreshold: 45,
};

// Min/max bounds for safety (Phase 10)
const WEIGHT_MIN_FACTOR = 0.25;
const WEIGHT_MAX_FACTOR = 3.0;  // weight cannot exceed 300% of default
const MIN_VERIFIED_PREDICTIONS = 50; // minimum sample size before adjusting
const LEARNING_RATE = 0.15;  // how aggressively weights update per cycle

// ─── File I/O helpers (server-side only) ─────────────────────────────────────

const getWeightsPath = () => {
  if (typeof window !== 'undefined') return '';
  const path = require('path');
  return path.join(process.cwd(), 'lib', 'adaptive-weights-history.json');
};

const readWeightHistory = (): WeightSnapshot[] => {
  if (typeof window !== 'undefined') return [];
  const fs = require('fs');
  const filePath = getWeightsPath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[AdaptiveWeights] Error reading weight history:', err);
  }
  return [];
};

const writeWeightHistory = (history: WeightSnapshot[]): void => {
  if (typeof window !== 'undefined') return;
  const fs = require('fs');
  const filePath = getWeightsPath();
  try {
    // Keep only last 100 snapshots to avoid unbounded growth
    const trimmed = history.slice(-100);
    fs.writeFileSync(filePath, JSON.stringify(trimmed, null, 2), 'utf8');
  } catch (err) {
    console.error('[AdaptiveWeights] Error writing weight history:', err);
  }
};

// ─── Core Analysis ───────────────────────────────────────────────────────────

/**
 * Indicator mapping from explainability contribution field names
 * to their corresponding TuningConfig weight keys.
 */
const INDICATOR_MAP: { name: string; contributionKey: string; weightKeys: (keyof AdaptiveWeights)[] }[] = [
  { name: 'trend',       contributionKey: 'trend_contribution',              weightKeys: ['weightSma200', 'weightSma50', 'weightSma20', 'weightEmaCross'] },
  { name: 'rsi',         contributionKey: 'rsi_contribution',                weightKeys: ['weightRsiBullish'] },
  { name: 'macd',        contributionKey: 'macd_contribution',               weightKeys: ['weightMacd'] },
  { name: 'volume',      contributionKey: 'volume_contribution',             weightKeys: ['weightVolume'] },
  { name: 'volatility',  contributionKey: 'volatility_contribution',         weightKeys: ['weightBbandMiddle', 'weightBbandUpper'] },
  { name: 'stochastic',  contributionKey: 'stochastic_contribution',         weightKeys: ['weightStochastic'] },
  { name: 'williamsR',   contributionKey: 'williams_r_contribution',         weightKeys: ['weightWilliamsR'] },
];

/**
 * Analyze verified predictions to compute per-indicator performance metrics.
 * Only considers records that have explanation data.
 */
export function analyzeIndicatorPerformance(verifiedRecords: PredictionRecord[]): IndicatorPerformance[] {
  // Filter to only records with explanation data
  const withExplanation = verifiedRecords.filter(
    r => r.status === 'VERIFIED' && r.explanation && r.prediction_result
  );

  const currentWeights = loadCurrentWeights();
  const performances: IndicatorPerformance[] = [];

  for (const indicator of INDICATOR_MAP) {
    let activeCorrect = 0;
    let activeIncorrect = 0;
    let activePartial = 0;
    let activeNeutral = 0;
    let inactiveCorrect = 0;
    let inactiveIncorrect = 0;
    let totalActive = 0;
    let totalInactive = 0;

    for (const record of withExplanation) {
      const contribution = (record.explanation as any)?.[indicator.contributionKey] || 0;
      const isActive = Math.abs(contribution) > 0;
      const result = record.prediction_result;

      if (isActive) {
        totalActive++;
        if (result === 'CORRECT') activeCorrect++;
        else if (result === 'INCORRECT') activeIncorrect++;
        else if (result === 'PARTIALLY_CORRECT') activePartial++;
        else activeNeutral++;
      } else {
        totalInactive++;
        if (result === 'CORRECT') inactiveCorrect++;
        else if (result === 'INCORRECT') inactiveIncorrect++;
      }
    }

    const directionalActive = totalActive - activeNeutral;
    const accuracyWhenActive = directionalActive > 0
      ? ((activeCorrect + activePartial * 0.5) / directionalActive) * 100
      : 0;

    const directionalInactive = totalInactive;
    const accuracyWhenInactive = directionalInactive > 0
      ? (inactiveCorrect / directionalInactive) * 100
      : 0;

    // Correlation: positive means indicator helps, negative means it hurts
    const correlationCorrect = accuracyWhenActive - accuracyWhenInactive;
    const correlationIncorrect = -correlationCorrect;

    // Reliability: consistency over time (split into 4 quarters)
    const quarterSize = Math.ceil(withExplanation.length / 4);
    const quarterAccuracies: number[] = [];
    for (let q = 0; q < 4; q++) {
      const quarterRecords = withExplanation.slice(q * quarterSize, (q + 1) * quarterSize);
      const qActive = quarterRecords.filter(r => ((r.explanation as any)?.[indicator.contributionKey] || 0) > 0);
      const qDirectional = qActive.filter(r => r.predicted_direction !== 'NEUTRAL');
      if (qDirectional.length > 5) {
        const qCorrect = qDirectional.filter(r => r.prediction_result === 'CORRECT').length;
        quarterAccuracies.push((qCorrect / qDirectional.length) * 100);
      }
    }
    const reliability = quarterAccuracies.length >= 2
      ? 100 - (standardDeviation(quarterAccuracies) * 2) // Lower std dev = higher reliability
      : 0;

    // Statistical significance (confidence score)
    const confidenceScore = Math.min(100, Math.round((totalActive / withExplanation.length) * 100));

    // Determine current weight value (average across related weight keys)
    const avgCurrentWeight = indicator.weightKeys.reduce((sum, key) => {
      const val = Math.abs(currentWeights[key] / DEFAULT_WEIGHTS[key]);
      return sum + val;
    }, 0) / indicator.weightKeys.length;

    const prevHistory = readWeightHistory();
    const lastSnapshot = prevHistory.length > 0 ? prevHistory[prevHistory.length - 1] : null;
    const previousPerf = lastSnapshot?.indicatorPerformance?.find(p => p.indicator_name === indicator.name);

    performances.push({
      indicator_name: indicator.name,
      current_weight: Number(avgCurrentWeight.toFixed(2)),
      previous_weight: previousPerf?.current_weight ?? Number(avgCurrentWeight.toFixed(2)),
      accuracy_score: Number(accuracyWhenActive.toFixed(1)),
      reliability_score: Number(Math.max(0, Math.min(100, reliability)).toFixed(1)),
      confidence_score: confidenceScore,
      success_contribution: activeCorrect,
      failure_contribution: activeIncorrect,
      total_activations: totalActive,
      partial_contribution: activePartial,
      contribution_score: Number(correlationCorrect.toFixed(2)),
      data_status: totalActive < 10
        ? 'INSUFFICIENT_VERIFIED_DATA'
        : totalActive < MIN_VERIFIED_PREDICTIONS ? 'UNRELIABLE' : 'RELIABLE',
      correlation_correct: Number(correlationCorrect.toFixed(2)),
      correlation_incorrect: Number(correlationIncorrect.toFixed(2)),
      last_updated: new Date().toISOString(),
    });
  }

  return performances;
}

/**
 * Compute new adaptive weights based on indicator performance analysis.
 * Uses Bayesian-inspired update: new_weight = old_weight * (1 + lr * (accuracy - baseline))
 */
export function computeAdaptiveWeights(
  performances: IndicatorPerformance[],
  currentWeights?: AdaptiveWeights
): AdaptiveWeights {
  const base = currentWeights || { ...DEFAULT_WEIGHTS };
  const newWeights = { ...base };

  // Compute baseline accuracy (average across all indicators)
  const validPerfs = performances.filter(p => p.total_activations >= 10);
  if (validPerfs.length === 0) {
    return newWeights;
  }

  const baselineAccuracy = validPerfs.reduce((sum, p) => sum + p.accuracy_score, 0) / validPerfs.length;

  for (const perf of validPerfs) {
    const indicator = INDICATOR_MAP.find(i => i.name === perf.indicator_name);
    if (!indicator) continue;

    // How much better/worse than baseline
    const delta = (perf.accuracy_score - baselineAccuracy) / 100;
    // Scale by reliability
    const reliabilityFactor = perf.reliability_score / 100;
    // Compute update factor
    const updateFactor = 1 + LEARNING_RATE * delta * reliabilityFactor;

    for (const key of indicator.weightKeys) {
      const defaultVal = DEFAULT_WEIGHTS[key];
      const isNegative = defaultVal < 0;
      const absDefault = Math.abs(defaultVal);

      let newVal = Math.abs(newWeights[key]) * updateFactor;

      // Clamp to safety bounds
      const minBound = absDefault * WEIGHT_MIN_FACTOR;
      const maxBound = absDefault * WEIGHT_MAX_FACTOR;
      newVal = Math.max(minBound, Math.min(maxBound, newVal));

      (newWeights as any)[key] = isNegative ? -Number(newVal.toFixed(4)) : Number(newVal.toFixed(4));
    }
  }

  return newWeights;
}

/**
 * Load current adaptive weights. Falls back to DEFAULT_WEIGHTS if no history exists.
 */
export function loadCurrentWeights(): AdaptiveWeights {
  const history = readWeightHistory();
  if (history.length > 0) {
    return { ...DEFAULT_WEIGHTS, ...history[history.length - 1].weights };
  }
  return { ...DEFAULT_WEIGHTS };
}

/**
 * Save a weight snapshot to history.
 */
export function saveWeightSnapshot(
  weights: AdaptiveWeights,
  accuracy: number,
  verifiedCount: number,
  performances: IndicatorPerformance[]
): void {
  const history = readWeightHistory();
  history.push({
    timestamp: new Date().toISOString(),
    weights,
    accuracyAtTime: accuracy,
    verifiedCount,
    indicatorPerformance: performances,
  });
  writeWeightHistory(history);

  const ratios = Object.fromEntries(INDICATOR_MAP.map(indicator => {
    const ratio = indicator.weightKeys.reduce(
      (sum, key) => sum + Math.abs(weights[key] / DEFAULT_WEIGHTS[key]),
      0
    ) / indicator.weightKeys.length;
    return [indicator.name, Number(Math.max(WEIGHT_MIN_FACTOR, Math.min(WEIGHT_MAX_FACTOR, ratio)).toFixed(4))];
  }));
  const fs = require('fs');
  const path = require('path');
  const artifactsDir = path.join(process.cwd(), 'artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.writeFileSync(path.join(artifactsDir, 'indicator_weights.json'), JSON.stringify(ratios, null, 2), 'utf8');
}

/**
 * Get the full weight adjustment history for dashboard display.
 */
export function getWeightHistory(): WeightSnapshot[] {
  return readWeightHistory();
}

/**
 * Get indicator performance rankings (sorted by accuracy score descending).
 */
export function getIndicatorRankings(): IndicatorPerformance[] {
  const history = readWeightHistory();
  if (history.length === 0) return [];
  const latest = history[history.length - 1];
  return [...(latest.indicatorPerformance || [])].sort((a, b) => b.accuracy_score - a.accuracy_score);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}
