-- Add version tracking fields to predictions table
ALTER TABLE public.predictions 
ADD COLUMN IF NOT EXISTS engine_version TEXT,
ADD COLUMN IF NOT EXISTS feature_version TEXT,
ADD COLUMN IF NOT EXISTS calibration_version TEXT,
ADD COLUMN IF NOT EXISTS regime_version TEXT;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
