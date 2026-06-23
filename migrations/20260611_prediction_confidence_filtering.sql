ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS market_regime TEXT,
  ADD COLUMN IF NOT EXISTS signal_strength TEXT,
  ADD COLUMN IF NOT EXISTS confidence_before_filter NUMERIC,
  ADD COLUMN IF NOT EXISTS confidence_after_filter NUMERIC,
  ADD COLUMN IF NOT EXISTS signal_quality TEXT,
  ADD COLUMN IF NOT EXISTS filter_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_tradeable_signal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_position_size NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS calibrated_prob_up NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS reliability_grade TEXT,
  ADD COLUMN IF NOT EXISTS stock_reliability_score NUMERIC,
  ADD COLUMN IF NOT EXISTS timeframe_reliability_score NUMERIC;

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_confidence_before_filter_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_confidence_before_filter_check
  CHECK (confidence_before_filter IS NULL OR confidence_before_filter BETWEEN 0 AND 100);

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_confidence_after_filter_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_confidence_after_filter_check
  CHECK (confidence_after_filter IS NULL OR confidence_after_filter BETWEEN 0 AND 100);

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_stock_reliability_score_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_stock_reliability_score_check
  CHECK (stock_reliability_score IS NULL OR stock_reliability_score BETWEEN 0 AND 100);

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_timeframe_reliability_score_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_timeframe_reliability_score_check
  CHECK (timeframe_reliability_score IS NULL OR timeframe_reliability_score BETWEEN 0 AND 100);

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_max_position_size_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_max_position_size_check
  CHECK (max_position_size IS NULL OR max_position_size BETWEEN 0 AND 1);

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_calibrated_prob_up_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_calibrated_prob_up_check
  CHECK (calibrated_prob_up IS NULL OR calibrated_prob_up BETWEEN 0 AND 1);

CREATE INDEX IF NOT EXISTS idx_predictions_tradeable_signal
  ON predictions(is_tradeable_signal);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_metrics_unique_pred_id
  ON prediction_metrics(prediction_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_explanations_unique_pred_id
  ON prediction_explanations(prediction_id);

NOTIFY pgrst, 'reload schema';
