import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyDirectionalMove, getDirectionalMoveThreshold } from './labeling.ts';

test('raises the directional threshold for more volatile instruments', () => {
  const lowVol = getDirectionalMoveThreshold({ price: 100, volatility: 0.012, timeframeDays: 7 });
  const highVol = getDirectionalMoveThreshold({ price: 100, volatility: 0.045, timeframeDays: 7 });

  assert.ok(lowVol < highVol);
});

test('classifies neutral moves inside the adaptive band', () => {
  assert.equal(
    classifyDirectionalMove(100, 101, { price: 100, volatility: 0.03, timeframeDays: 7 }),
    'NEUTRAL'
  );
});

test('classifies directional moves beyond the adaptive band', () => {
  assert.equal(
    classifyDirectionalMove(100, 105, { price: 100, volatility: 0.02, timeframeDays: 7 }),
    'UP'
  );
  assert.equal(
    classifyDirectionalMove(100, 94, { price: 100, volatility: 0.02, timeframeDays: 7 }),
    'DOWN'
  );
});
