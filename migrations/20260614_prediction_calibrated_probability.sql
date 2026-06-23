-- Persist the calibrated probability used by evaluation and reliability metrics.
-- This column stores the walk-forward ensemble's calibrated P(up) in [0, 1].
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS calibrated_prob_up NUMERIC(8, 6);

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_calibrated_prob_up_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_calibrated_prob_up_check
  CHECK (calibrated_prob_up IS NULL OR calibrated_prob_up BETWEEN 0 AND 1);

-- Refresh the PostgREST schema cache so the new column is immediately visible
-- to the Next.js API routes without restarting the PostgREST process.
NOTIFY pgrst, 'reload schema';
