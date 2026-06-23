import type { PredictionRecord } from './predictions-db';

const VALID_RESULTS = new Set(['CORRECT', 'INCORRECT', 'PARTIALLY_CORRECT', 'NEUTRAL']);
const VALID_REGIMES = new Set(['BULL', 'BEAR', 'SIDEWAYS', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'TRENDING', 'MEAN_REVERTING']);

export interface IntegrityWarning {
  code: string;
  label: string;
  count: number;
  severity: 'warning' | 'error';
}

export function buildIntegrityWarnings(records: PredictionRecord[]): IntegrityWarning[] {
  const verified = records.filter(record => record.status === 'VERIFIED');
  const checks: Array<[string, string, 'warning' | 'error', (record: PredictionRecord) => boolean]> = [
    ['missing_model_version', 'Missing model_version', 'error', r => !r.model_version],
    ['missing_market_regime', 'Missing market_regime', 'warning', r => !r.regime || !VALID_REGIMES.has(r.regime)],
    ['missing_indicator_contributions', 'Missing indicator_contributions', 'warning', r => !r.explanation],
    ['missing_confidence_score', 'Missing confidence_score', 'error', r => !Number.isFinite(r.confidence_score)],
    ['invalid_confidence_score', 'Impossible confidence percentage', 'error', r => Number.isFinite(r.confidence_score) && (r.confidence_score < 0 || r.confidence_score > 100)],
    ['invalid_prediction_result', 'Invalid prediction_result', 'error', r => !r.prediction_result || !VALID_RESULTS.has(r.prediction_result)],
  ];

  return checks
    .map(([code, label, severity, predicate]) => ({ code, label, severity, count: verified.filter(predicate).length }))
    .filter(warning => warning.count > 0);
}
