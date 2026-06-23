import type { PredictionRecord } from './predictions-db';
import { getFilterReason } from './prediction-analytics.ts';

export const ALLOWED_EVALUATION_BATCH_SIZES = [100, 1_000, 10_000, 100_000] as const;

export function parseEvaluationBatchSize(value: unknown): number | null {
  const parsed = Number(value ?? 10_000);
  return Number.isInteger(parsed) && (ALLOWED_EVALUATION_BATCH_SIZES as readonly number[]).includes(parsed)
    ? parsed
    : null;
}

export function computeDirectionalBrierScore(records: PredictionRecord[], useCalibrated: boolean = true): number | null {
  const validRecords = records.filter(record => 
    record.status === 'VERIFIED' && 
    getFilterReason(record) === null &&
    record.predicted_direction !== 'NEUTRAL' &&
    record.prediction_result !== 'NEUTRAL'
  );

  if (validRecords.length === 0) return null;

  const score = validRecords.reduce((sum, record) => {
    let probabilityUp = record.predicted_direction === 'UP'
      ? record.confidence_score / 100
      : record.predicted_direction === 'DOWN'
        ? 1 - (record.confidence_score / 100)
        : 0.5;

    if (useCalibrated && record.calibrated_prob_up !== undefined && record.calibrated_prob_up !== null) {
      probabilityUp = record.calibrated_prob_up;
    }

    const actualUp = record.actual_direction === 'UP' ? 1 : 0;
    return sum + Math.pow(probabilityUp - actualUp, 2);
  }, 0) / validRecords.length;

  return Number(score.toFixed(6));
}
