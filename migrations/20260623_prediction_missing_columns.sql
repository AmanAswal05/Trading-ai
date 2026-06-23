-- Migration to add missing columns to the predictions table
-- This script contains all the fields added during the accuracy and safety improvements.

ALTER TABLE public.predictions 
ADD COLUMN IF NOT EXISTS trend_regime TEXT,
ADD COLUMN IF NOT EXISTS volatility_regime TEXT,
ADD COLUMN IF NOT EXISTS regime_confidence NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS regime_reason TEXT,
ADD COLUMN IF NOT EXISTS regime_adjusted_confidence NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS raw_confidence NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS calibrated_confidence NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS macro_adjusted_confidence NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS multi_timeframe_adjusted_confidence NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS final_confidence NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS raw_probability NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS calibrated_probability NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS final_probability NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS calibrated_prob_down NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS raw_prob_up NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS raw_prob_down NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS ensemble_prob_up NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS ensemble_prob_down NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS final_prob_up NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS final_prob_down NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS macro_risk_score NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS macro_bias TEXT,
ADD COLUMN IF NOT EXISTS alignment_score NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS timeframe_conflict BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trade_filter_score NUMERIC(8,6),
ADD COLUMN IF NOT EXISTS trade_filter_decision TEXT,
ADD COLUMN IF NOT EXISTS rejection_reasons JSONB;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
