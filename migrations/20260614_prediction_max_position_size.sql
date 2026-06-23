-- Add the position-sizing field written by prediction and backtest upserts.
-- Value is a multiplier in [0, 1]: 1.0 = full position, 0.25 = reduced, 0.0 = no trade.
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS max_position_size NUMERIC(8, 6);

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_max_position_size_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_max_position_size_check
  CHECK (max_position_size IS NULL OR max_position_size BETWEEN 0 AND 1);

-- Refresh the PostgREST schema cache so the new column is immediately visible
-- to the Next.js API routes without restarting the PostgREST process.
NOTIFY pgrst, 'reload schema';
