ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS market_regime TEXT,
  ADD COLUMN IF NOT EXISTS signal_strength TEXT,
  ADD COLUMN IF NOT EXISTS confidence_before_filter NUMERIC(5, 2);

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_confidence_score_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_confidence_score_check
  CHECK (confidence_score >= 0 AND confidence_score <= 100);

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_result_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_result_check
  CHECK (prediction_result IS NULL OR prediction_result IN ('CORRECT', 'INCORRECT', 'PARTIALLY_CORRECT', 'NEUTRAL'));

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_regime_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_regime_check
  CHECK (market_regime IS NULL OR market_regime IN ('BULL', 'BEAR', 'SIDEWAYS', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'TRENDING', 'MEAN_REVERTING'));

CREATE INDEX IF NOT EXISTS idx_predictions_model_version ON predictions(model_version);
CREATE INDEX IF NOT EXISTS idx_predictions_market_regime ON predictions(market_regime);
