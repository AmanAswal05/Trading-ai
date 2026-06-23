-- Add version tracking fields to predictions table
ALTER TABLE public.predictions 
ADD COLUMN IF NOT EXISTS engine_version TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS feature_version TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS calibration_version TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS regime_version TEXT DEFAULT 'unknown';

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
