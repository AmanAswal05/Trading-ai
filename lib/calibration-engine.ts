import { PredictionRecord } from './predictions-db';

export interface CalibrationBucket {
  range: string;              // e.g. '50-55', '55-60', ..., '95-100'
  rangeMin: number;
  rangeMax: number;
  predictedConfidence: number; // midpoint of range
  actualAccuracy: number;      // verified accuracy in this bucket
  sampleSize: number;
  calibrationError: number;    // |predicted - actual|
}

export interface CalibrationReport {
  buckets: CalibrationBucket[];
  overallCalibrationError: number; // weighted average of bucket errors
  isCalibrated: boolean;           // true if error < 5%
}

/**
 * Builds the confidence calibration report using historical verified predictions.
 */
export function buildCalibrationCurve(verifiedPredictions: PredictionRecord[]): CalibrationReport {
  const verified = verifiedPredictions.filter(
    r => r.status === 'VERIFIED' && r.prediction_result && r.confidence_score !== undefined
  );

  const buckets: CalibrationBucket[] = [];
  
  // We define 5% buckets from 50 to 100 (which is the active prediction range)
  // plus one catch-all bucket for below 50.
  const bucketRanges = [
    { min: 0, max: 50 },
    { min: 50, max: 55 },
    { min: 55, max: 60 },
    { min: 60, max: 65 },
    { min: 65, max: 70 },
    { min: 70, max: 75 },
    { min: 75, max: 80 },
    { min: 80, max: 85 },
    { min: 85, max: 90 },
    { min: 90, max: 95 },
    { min: 95, max: 100.1 } // inclusive of 100
  ];

  let totalWeightedError = 0;
  let totalSamplesCounted = 0;

  for (const range of bucketRanges) {
    const min = range.min;
    const max = range.max;
    const rangeStr = min === 0 ? '<50' : `${min}-${Math.floor(max)}`;

    const predictionsInBucket = verified.filter(
      p => p.confidence_score >= min && p.confidence_score < max
    );

    const count = predictionsInBucket.length;
    const midpoint = (min + Math.min(100, max)) / 2;

    let actualAccuracy = 50;
    if (count > 0) {
      const correct = predictionsInBucket.filter(p => p.prediction_result === 'CORRECT').length;
      const partial = predictionsInBucket.filter(p => p.prediction_result === 'PARTIALLY_CORRECT').length;
      const totalEvaluated = predictionsInBucket.filter(p => p.predicted_direction !== 'NEUTRAL').length;
      actualAccuracy = totalEvaluated > 0 ? ((correct + partial * 0.5) / totalEvaluated) * 100 : 50;
    } else {
      // If no data, assume midpoint as accuracy so calibration error is 0
      actualAccuracy = midpoint;
    }

    const calibrationError = Math.abs(midpoint - actualAccuracy);

    buckets.push({
      range: rangeStr,
      rangeMin: min,
      rangeMax: Math.min(100, max),
      predictedConfidence: Number(midpoint.toFixed(1)),
      actualAccuracy: Number(actualAccuracy.toFixed(1)),
      sampleSize: count,
      calibrationError: Number(calibrationError.toFixed(1)),
    });

    if (count > 0) {
      totalWeightedError += calibrationError * count;
      totalSamplesCounted += count;
    }
  }

  const overallCalibrationError = totalSamplesCounted > 0
    ? totalWeightedError / totalSamplesCounted
    : 0;

  return {
    buckets,
    overallCalibrationError: Number(overallCalibrationError.toFixed(2)),
    isCalibrated: overallCalibrationError < 5.0,
  };
}

/**
 * Calibrates a raw confidence score using the calibration curve.
 * Applies linear interpolation between the bucket's actual accuracy and raw confidence.
 * SAFETY: Never returns higher than the raw confidence score.
 */
export function calibrateConfidence(rawConfidence: number, report: CalibrationReport): number {
  const bucket = report.buckets.find(b => rawConfidence >= b.rangeMin && rawConfidence < b.rangeMax);
  if (!bucket || bucket.sampleSize < 20) {
    // Insufficient samples to calibrate, return unchanged
    return rawConfidence;
  }

  // Linear interpolation between the actual accuracy and the raw confidence
  // We shrink the raw confidence towards the actual historical accuracy.
  // calibrated = actualAccuracy + (rawConfidence - midpoint) * factor
  const midpoint = bucket.predictedConfidence;
  const actual = bucket.actualAccuracy;

  // Let's bring it 70% of the way towards actual accuracy to smooth out jumps
  const calibrated = actual + (rawConfidence - midpoint) * 0.3;

  // Safety ceiling: never inflate confidence beyond raw
  return Math.min(rawConfidence, Math.max(0, Math.round(calibrated)));
}

/**
 * Generates a human-readable summary of the calibration state.
 */
export function getCalibrationSummary(report: CalibrationReport): string {
  const err = report.overallCalibrationError.toFixed(1);
  if (report.isCalibrated) {
    return `Model confidence is well-calibrated (average calibration deviation is ${err}%).`;
  }
  return `Model confidence is slightly over-optimistic (average deviation is ${err}%). Calibrating values down.`;
}
