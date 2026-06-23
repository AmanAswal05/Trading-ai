import assert from 'node:assert/strict';
import test from 'node:test';
import { computeDirectionalBrierScore, parseEvaluationBatchSize } from './model-evaluation.ts';
import type { PredictionRecord } from './predictions-db.ts';

test('accepts every supported evaluation batch size', () => {
  for (const size of [100, 1_000, 10_000, 100_000]) {
    assert.equal(parseEvaluationBatchSize(size), size);
    assert.equal(parseEvaluationBatchSize(String(size)), size);
  }
});

test('rejects unsupported evaluation batch sizes', () => {
  for (const size of [0, 99, 101, 1_000_000, 'everything']) {
    assert.equal(parseEvaluationBatchSize(size), null);
  }
});

test('computes a directional Brier score', () => {
  const records = [
    {
      status: 'VERIFIED',
      predicted_direction: 'UP',
      prediction_result: 'CORRECT',
      confidence_score: 80,
      current_price: 100,
      predicted_price: 104,
      actual_price: 104,
      actual_direction: 'UP',
      verification_date: '2024-01-02',
    },
    {
      status: 'VERIFIED',
      predicted_direction: 'DOWN',
      prediction_result: 'INCORRECT',
      confidence_score: 70,
      current_price: 100,
      predicted_price: 96,
      actual_price: 104,
      actual_direction: 'UP',
      verification_date: '2024-01-02',
    },
  ] as PredictionRecord[];
  assert.equal(computeDirectionalBrierScore(records), 0.265);
});

test('prefers persisted calibrated probability for Brier score', () => {
  const records = [
    {
      status: 'VERIFIED',
      predicted_direction: 'UP',
      prediction_result: 'CORRECT',
      confidence_score: 95,
      current_price: 100,
      predicted_price: 110,
      actual_price: 110,
      calibrated_prob_up: 0.7,
      actual_direction: 'UP',
      verification_date: '2024-01-02',
    },
  ] as PredictionRecord[];
  assert.equal(computeDirectionalBrierScore(records), 0.09);
});
