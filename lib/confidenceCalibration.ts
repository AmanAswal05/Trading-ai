/* eslint-disable @typescript-eslint/no-explicit-any */
import { PredictionRecord } from './predictions-db';
import { WalkForwardMetric } from './backtesting/data-cache';

export interface IsotonicBucket {
  rangeMin: number;
  rangeMax: number;
  calibratedValue: number;
}

export interface CalibrationResult {
  method: 'ISOTONIC' | 'TEMPERATURE' | 'NONE';
  ece: number;
  brierScore: number;
  nll?: number;
  isotonicModel?: IsotonicBucket[];
  temperature?: number;
  isCalibrated: boolean;
}

/**
 * Calculates Expected Calibration Error (ECE) for a set of predictions and their calibrated probabilities.
 */
export function calculateECE(predictions: { prob: number; actual: number }[], bins: number = 10): number {
  if (predictions.length === 0) return 0;
  
  // Sort by probability
  const sorted = [...predictions].sort((a, b) => a.prob - b.prob);
  const binSize = Math.ceil(sorted.length / bins);
  
  let ece = 0;
  for (let i = 0; i < bins; i++) {
    const bin = sorted.slice(i * binSize, (i + 1) * binSize);
    if (bin.length === 0) continue;
    
    const avgProb = bin.reduce((sum, p) => sum + p.prob, 0) / bin.length;
    const avgActual = bin.reduce((sum, p) => sum + p.actual, 0) / bin.length;
    
    ece += (bin.length / sorted.length) * Math.abs(avgProb - avgActual);
  }
  
  return ece;
}

/**
 * Calculates Brier Score.
 */
export function calculateBrierScore(predictions: { prob: number; actual: number }[]): number {
  if (predictions.length === 0) return 0;
  return predictions.reduce((sum, p) => sum + Math.pow(p.prob - p.actual, 2), 0) / predictions.length;
}

/**
 * Calculates Negative Log Likelihood.
 */
export function calculateNLL(predictions: { prob: number; actual: number }[]): number {
  if (predictions.length === 0) return 0;
  return -predictions.reduce((sum, p) => {
    const prob = Math.min(Math.max(p.prob, 1e-15), 1 - 1e-15);
    return sum + (p.actual === 1 ? Math.log(prob) : Math.log(1 - prob));
  }, 0) / predictions.length;
}

/**
 * Pool Adjacent Violators Algorithm (PAVA) for Isotonic Regression.
 * Fits a monotonically increasing step function.
 */
export function fitIsotonicCalibrator(trainingPredictions: PredictionRecord[]): IsotonicBucket[] | null {
  const data = trainingPredictions
    .filter(p => p.prediction_result === 'CORRECT' || p.prediction_result === 'INCORRECT')
    .map(p => ({
      prob: Math.min(100, Math.max(0, p.regime_adjusted_confidence ?? p.confidence_score)) / 100,
      actual: p.prediction_result === 'CORRECT' ? 1 : 0
    }))
    .sort((a, b) => a.prob - b.prob);

  if (data.length < 300) {
    return null; // Not enough data for stable isotonic regression
  }

  // PAVA
  const blocks = data.map(d => ({ weight: 1, sum: d.actual, val: d.actual, minProb: d.prob, maxProb: d.prob }));

  let i = 0;
  while (i < blocks.length - 1) {
    if (blocks[i].val > blocks[i + 1].val) {
      // Violation! Merge block i and i+1
      blocks[i].weight += blocks[i + 1].weight;
      blocks[i].sum += blocks[i + 1].sum;
      blocks[i].val = blocks[i].sum / blocks[i].weight;
      blocks[i].maxProb = blocks[i + 1].maxProb;
      blocks.splice(i + 1, 1);
      
      // Step back to check for cascading violations
      if (i > 0) i--;
    } else {
      i++;
    }
  }

  // Convert blocks to IsotonicBuckets
  const model: IsotonicBucket[] = [];
  for (let j = 0; j < blocks.length; j++) {
    model.push({
      rangeMin: j === 0 ? 0 : blocks[j].minProb,
      rangeMax: j === blocks.length - 1 ? 1.01 : blocks[j+1].minProb,
      calibratedValue: blocks[j].val
    });
  }

  return model;
}

export function applyIsotonicCalibration(probability: number, model: IsotonicBucket[] | null): number {
  if (!model) return probability;
  const prob = Math.min(1.0, Math.max(0.0, probability));
  const bucket = model.find(b => prob >= b.rangeMin && prob < b.rangeMax);
  return bucket ? bucket.calibratedValue : prob;
}

/**
 * Fits a Temperature Scaling calibrator by finding T to minimize NLL.
 */
export function fitTemperatureScaler(trainingPredictions: PredictionRecord[]): number | null {
  const data = trainingPredictions
    .filter(p => p.prediction_result === 'CORRECT' || p.prediction_result === 'INCORRECT')
    .map(p => ({
      prob: Math.min(100, Math.max(0, p.regime_adjusted_confidence ?? p.confidence_score)) / 100,
      actual: p.prediction_result === 'CORRECT' ? 1 : 0
    }));

  if (data.length < 80) return null;

  let bestT = 1.0;
  let bestNLL = Infinity;

  // Search T from 0.5 to 5.0 in increments of 0.05
  for (let t = 0.5; t <= 5.0; t += 0.05) {
    const calibrated = data.map(d => ({
      prob: applyTemperatureScaling(d.prob, t),
      actual: d.actual
    }));
    const nll = calculateNLL(calibrated);
    if (nll < bestNLL) {
      bestNLL = nll;
      bestT = t;
    }
  }

  return bestT;
}

export function applyTemperatureScaling(probability: number, temperature: number | null): number {
  if (!temperature || temperature <= 0) return probability;
  // Clip prob to avoid logit +/- Infinity
  const p = Math.min(0.999, Math.max(0.001, probability));
  const logit = Math.log(p / (1 - p));
  const scaledLogit = logit / temperature;
  return 1 / (1 + Math.exp(-scaledLogit));
}

export function compareCalibrationMethods(
  validationPredictions: PredictionRecord[],
  isotonicModel: IsotonicBucket[] | null,
  temperature: number | null
): CalibrationResult {
  const rawData = validationPredictions
    .filter(p => p.prediction_result === 'CORRECT' || p.prediction_result === 'INCORRECT')
    .map(p => ({
      prob: Math.min(100, Math.max(0, p.regime_adjusted_confidence ?? p.confidence_score)) / 100,
      actual: p.prediction_result === 'CORRECT' ? 1 : 0
    }));

  if (rawData.length === 0) {
    return {
      method: 'NONE',
      ece: 0,
      brierScore: 0,
      isCalibrated: false
    };
  }

  const rawECE = calculateECE(rawData);
  const rawBrier = calculateBrierScore(rawData);

  let bestMethod: 'ISOTONIC' | 'TEMPERATURE' | 'NONE' = 'NONE';
  let bestECE = rawECE;
  let bestBrier = rawBrier;
  let bestNLL = calculateNLL(rawData);

  // Evaluate Isotonic
  if (isotonicModel) {
    const isoData = rawData.map(d => ({
      prob: applyIsotonicCalibration(d.prob, isotonicModel),
      actual: d.actual
    }));
    const isoECE = calculateECE(isoData);
    const isoBrier = calculateBrierScore(isoData);
    
    // We only select if it improves ECE
    if (isoECE < bestECE) {
      bestECE = isoECE;
      bestBrier = isoBrier;
      bestNLL = calculateNLL(isoData);
      bestMethod = 'ISOTONIC';
    }
  }

  // Evaluate Temperature
  if (temperature) {
    const tempData = rawData.map(d => ({
      prob: applyTemperatureScaling(d.prob, temperature),
      actual: d.actual
    }));
    const tempECE = calculateECE(tempData);
    const tempBrier = calculateBrierScore(tempData);

    // Temperature is often more robust, so prefer it if ECE is very close
    if (tempECE < bestECE || (bestMethod === 'ISOTONIC' && Math.abs(tempECE - bestECE) < 0.01 && tempBrier < bestBrier)) {
      bestECE = tempECE;
      bestBrier = tempBrier;
      bestNLL = calculateNLL(tempData);
      bestMethod = 'TEMPERATURE';
    }
  }

  return {
    method: bestMethod,
    ece: bestECE,
    brierScore: bestBrier,
    nll: bestNLL,
    isotonicModel: (bestMethod === 'ISOTONIC' ? isotonicModel : undefined) || undefined,
    temperature: (bestMethod === 'TEMPERATURE' ? temperature : undefined) || undefined,
    isCalibrated: bestECE < 0.05
  };
}

export interface ReliabilityBucket {
  range: string;
  count: number;
  avgRawConf: number;
  avgCalConf: number;
  winRate: number;
  rawGap: number;
  calGap: number;
}

export function generateReliabilityTable(
  predictions: PredictionRecord[],
  calibrationResult: CalibrationResult | null
): ReliabilityBucket[] {
  const data = predictions
    .filter(p => p.prediction_result === 'CORRECT' || p.prediction_result === 'INCORRECT')
    .map(p => {
      const rawProb = Math.min(100, Math.max(0, p.regime_adjusted_confidence ?? p.confidence_score)) / 100;
      let calProb = rawProb;
      if (calibrationResult?.method === 'ISOTONIC' && calibrationResult.isotonicModel) {
        calProb = applyIsotonicCalibration(rawProb, calibrationResult.isotonicModel);
      } else if (calibrationResult?.method === 'TEMPERATURE' && calibrationResult.temperature) {
        calProb = applyTemperatureScaling(rawProb, calibrationResult.temperature);
      }
      return {
        raw: rawProb,
        cal: calProb,
        actual: p.prediction_result === 'CORRECT' ? 1 : 0
      };
    });

  const buckets = [
    { min: 0.5, max: 0.6, label: '50-60%' },
    { min: 0.6, max: 0.7, label: '60-70%' },
    { min: 0.7, max: 0.8, label: '70-80%' },
    { min: 0.8, max: 0.9, label: '80-90%' },
    { min: 0.9, max: 1.01, label: '90-100%' }
  ];

  return buckets.map(b => {
    const inBucket = data.filter(d => d.raw >= b.min && d.raw < b.max);
    if (inBucket.length === 0) {
      return {
        range: b.label,
        count: 0,
        avgRawConf: 0,
        avgCalConf: 0,
        winRate: 0,
        rawGap: 0,
        calGap: 0
      };
    }
    
    const avgRaw = inBucket.reduce((sum, d) => sum + d.raw, 0) / inBucket.length;
    const avgCal = inBucket.reduce((sum, d) => sum + d.cal, 0) / inBucket.length;
    const winRate = inBucket.reduce((sum, d) => sum + d.actual, 0) / inBucket.length;

    return {
      range: b.label,
      count: inBucket.length,
      avgRawConf: avgRaw * 100,
      avgCalConf: avgCal * 100,
      winRate: winRate * 100,
      rawGap: (avgRaw - winRate) * 100,
      calGap: (avgCal - winRate) * 100
    };
  });
}

// ─── Adapters for Legacy calibration-engine ───

export function buildCalibrationCurve(verifiedPredictions: PredictionRecord[]) {
  const isotonicModel = fitIsotonicCalibrator(verifiedPredictions);
  const temperature = fitTemperatureScaler(verifiedPredictions);
  const calibrationResult = compareCalibrationMethods(verifiedPredictions, isotonicModel, temperature);
  
  const buckets = generateReliabilityTable(verifiedPredictions, calibrationResult);
  
  return {
    buckets,
    overallCalibrationError: Number((calibrationResult.ece * 100).toFixed(2)),
    isCalibrated: calibrationResult.isCalibrated,
    isotonicModel: calibrationResult.isotonicModel,
    temperature: calibrationResult.temperature,
    method: calibrationResult.method,
  };
}

export function calibrateConfidence(rawConfidence: number, report: any): number {
  const prob = rawConfidence / 100;
  let calProb = prob;
  if (report?.method === 'ISOTONIC' && report.isotonicModel) {
    calProb = applyIsotonicCalibration(prob, report.isotonicModel);
  } else if (report?.method === 'TEMPERATURE' && report.temperature) {
    calProb = applyTemperatureScaling(prob, report.temperature);
  }
  return Math.round(calProb * 100);
}

// ─── Walk-Forward Historical Calibration ───

export function getConfidenceBucket(conf: number) {
  if (conf >= 90) return '90-100';
  if (conf >= 80) return '80-90';
  if (conf >= 75) return '75-80';
  if (conf >= 70) return '70-75';
  if (conf >= 65) return '65-70';
  if (conf >= 60) return '60-65';
  if (conf >= 55) return '55-60';
  return '50-55';
}

export function calibrateConfidenceFromWalkForward(
  rawConfidence: number,
  timeframe: string,
  regime: string,
  wfMetrics: WalkForwardMetric[],
  ticker?: string
): { calibratedConfidence: number; reason: string } {
  const bucket = getConfidenceBucket(rawConfidence);
  
  // 1. Try to find ticker-specific exact match
  const matchedMetrics = wfMetrics.filter(m => 
    m.ticker === ticker && 
    m.timeframe === timeframe && 
    m.regime === regime && 
    m.confidenceBucket === bucket
  );
  
  let totalTrades = matchedMetrics.reduce((sum, m) => sum + m.trades, 0);
  let avgAccuracy = totalTrades > 0 ? matchedMetrics.reduce((sum, m) => sum + (m.accuracy * m.trades), 0) / totalTrades : 0;
  
  // 2. If sample size is too small (< 30), fallback to global average across all tickers for this bucket + regime
  if (totalTrades < 30) {
    const globalMetrics = wfMetrics.filter(m => 
      m.timeframe === timeframe && 
      m.regime === regime && 
      m.confidenceBucket === bucket
    );
    const globalTrades = globalMetrics.reduce((sum, m) => sum + m.trades, 0);
    if (globalTrades >= 30) {
      avgAccuracy = globalMetrics.reduce((sum, m) => sum + (m.accuracy * m.trades), 0) / globalTrades;
      totalTrades = globalTrades;
    }
  }
  
  // 3. Apply calibration
  if (totalTrades < 30) {
    // Still not enough data -> Conservative guardrail
    const conservativeConf = Math.min(rawConfidence, 60);
    return {
      calibratedConfidence: conservativeConf,
      reason: `[WALK-FORWARD UNVALIDATED: Not enough validated history (${totalTrades} trades). Using conservative confidence.]`
    };
  }

  // 4. We have enough trades -> Calibrate towards actual accuracy
  let newConf = rawConfidence;
  let reason = '';
  
  // If actual accuracy is significantly worse than raw confidence
  if (avgAccuracy < rawConfidence - 5) {
     newConf = Math.min(rawConfidence, Math.max(50, avgAccuracy + 5)); // Pull down aggressively but leave a small buffer
     reason = `[CALIBRATED DOWN: Historical '${bucket}' bucket accuracy is only ${avgAccuracy.toFixed(1)}% (${totalTrades} trades).]`;
  } else if (avgAccuracy > rawConfidence + 5) {
     // Model is underconfident, we can bump slightly but safely
     newConf = Math.min(95, rawConfidence + 2); 
     reason = `[CALIBRATED UP: Historical '${bucket}' bucket accuracy is strong at ${avgAccuracy.toFixed(1)}%.]`;
  } else {
     reason = `[CALIBRATED: Matches historical accuracy (${avgAccuracy.toFixed(1)}%).]`;
  }
  
  return { calibratedConfidence: Math.round(newConf), reason };
}
