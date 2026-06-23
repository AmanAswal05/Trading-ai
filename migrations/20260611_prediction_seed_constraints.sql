-- Allow backtest reruns to update metrics and explanations for an existing prediction.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_metrics_unique_pred_id
  ON prediction_metrics(prediction_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_explanations_unique_pred_id
  ON prediction_explanations(prediction_id);
