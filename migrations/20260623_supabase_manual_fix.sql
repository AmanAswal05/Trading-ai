-- ==============================================================================
-- SUPABASE MANUAL FIX: MISSING PREDICTION COLUMNS
-- ==============================================================================
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- This script does two things:
-- 1. Installs the 'apply_pending_migrations' RPC function used by the Next.js API.
-- 2. Directly adds all missing columns to the predictions table.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: CREATE OR UPDATE THE RPC FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_pending_migrations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB := '{"applied": [], "skipped": [], "errors": []}'::JSONB;
  col_exists BOOLEAN;
BEGIN
  -- 1. calibrated_prob_up
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'predictions' AND column_name = 'calibrated_prob_up'
  ) INTO col_exists;

  IF NOT col_exists THEN
    ALTER TABLE predictions ADD COLUMN calibrated_prob_up NUMERIC(8, 6);
    result := jsonb_set(result, '{applied}', result->'applied' || '["calibrated_prob_up"]');
  ELSE
    result := jsonb_set(result, '{skipped}', result->'skipped' || '["calibrated_prob_up"]');
  END IF;

  -- 2. max_position_size
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'predictions' AND column_name = 'max_position_size'
  ) INTO col_exists;

  IF NOT col_exists THEN
    ALTER TABLE predictions ADD COLUMN max_position_size NUMERIC(8, 6);
    result := jsonb_set(result, '{applied}', result->'applied' || '["max_position_size"]');
  ELSE
    result := jsonb_set(result, '{skipped}', result->'skipped' || '["max_position_size"]');
  END IF;

  -- 3. New Confidence & Regime fields
  ALTER TABLE predictions
    ADD COLUMN IF NOT EXISTS market_regime TEXT,
    ADD COLUMN IF NOT EXISTS signal_strength TEXT,
    ADD COLUMN IF NOT EXISTS confidence_before_filter NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS confidence_after_filter NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS signal_quality TEXT,
    ADD COLUMN IF NOT EXISTS filter_reason TEXT,
    ADD COLUMN IF NOT EXISTS is_tradeable_signal BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS reliability_grade TEXT,
    ADD COLUMN IF NOT EXISTS stock_reliability_score NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS timeframe_reliability_score NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS raw_confidence NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS calibrated_confidence NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS regime_adjusted_confidence NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS macro_adjusted_confidence NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS multi_timeframe_adjusted_confidence NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS final_confidence NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS raw_probability NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS calibrated_probability NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS final_probability NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS calibrated_prob_down NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS raw_prob_up NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS raw_prob_down NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS ensemble_prob_up NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS ensemble_prob_down NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS final_prob_up NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS final_prob_down NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS trend_regime TEXT,
    ADD COLUMN IF NOT EXISTS volatility_regime TEXT,
    ADD COLUMN IF NOT EXISTS regime_confidence NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS regime_reason TEXT,
    ADD COLUMN IF NOT EXISTS macro_risk_score NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS macro_bias TEXT,
    ADD COLUMN IF NOT EXISTS alignment_score NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS timeframe_conflict BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS trade_filter_score NUMERIC(8, 6),
    ADD COLUMN IF NOT EXISTS trade_filter_decision TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reasons JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS engine_version TEXT DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS feature_version TEXT DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS calibration_version TEXT DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS regime_version TEXT DEFAULT 'unknown';
    
  result := jsonb_set(result, '{applied}', result->'applied' || '["confidence_and_regime_fields"]');

  -- 4. Constraints
  ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_calibrated_prob_up_check;
  ALTER TABLE predictions ADD CONSTRAINT predictions_calibrated_prob_up_check
    CHECK (calibrated_prob_up IS NULL OR calibrated_prob_up BETWEEN 0 AND 1);

  ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_max_position_size_check;
  ALTER TABLE predictions ADD CONSTRAINT predictions_max_position_size_check
    CHECK (max_position_size IS NULL OR max_position_size BETWEEN 0 AND 1);

  -- 5. Reload PostgREST schema cache
  NOTIFY pgrst, 'reload schema';

  RETURN result;
END;
$$;

-- Allow the anon role to call it
GRANT EXECUTE ON FUNCTION public.apply_pending_migrations() TO anon;
GRANT EXECUTE ON FUNCTION public.apply_pending_migrations() TO authenticated;

-- ------------------------------------------------------------------------------
-- STEP 2: IMMEDIATELY ADD MISSING COLUMNS
-- ------------------------------------------------------------------------------
-- We run the same ALTER TABLE commands outside the function so that running 
-- this script instantly fixes the missing column error without requiring an API call.
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS market_regime TEXT,
  ADD COLUMN IF NOT EXISTS signal_strength TEXT,
  ADD COLUMN IF NOT EXISTS confidence_before_filter NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS confidence_after_filter NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS signal_quality TEXT,
  ADD COLUMN IF NOT EXISTS filter_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_tradeable_signal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reliability_grade TEXT,
  ADD COLUMN IF NOT EXISTS stock_reliability_score NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS timeframe_reliability_score NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS raw_confidence NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS calibrated_confidence NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS regime_adjusted_confidence NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS macro_adjusted_confidence NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS multi_timeframe_adjusted_confidence NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS final_confidence NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS raw_probability NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS calibrated_probability NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS final_probability NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS calibrated_prob_down NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS raw_prob_up NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS raw_prob_down NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS ensemble_prob_up NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS ensemble_prob_down NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS final_prob_up NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS final_prob_down NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS trend_regime TEXT,
  ADD COLUMN IF NOT EXISTS volatility_regime TEXT,
  ADD COLUMN IF NOT EXISTS regime_confidence NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS regime_reason TEXT,
  ADD COLUMN IF NOT EXISTS macro_risk_score NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS macro_bias TEXT,
  ADD COLUMN IF NOT EXISTS alignment_score NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS timeframe_conflict BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trade_filter_score NUMERIC(8, 6),
  ADD COLUMN IF NOT EXISTS trade_filter_decision TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reasons JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS engine_version TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS feature_version TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS calibration_version TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS regime_version TEXT DEFAULT 'unknown';

-- Force reload schema again
NOTIFY pgrst, 'reload schema';
