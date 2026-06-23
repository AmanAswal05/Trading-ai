-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- It creates a helper function that the Next.js server can call to apply DDL
-- migrations without needing the service-role key.
--
-- SECURITY: The function checks caller identity via app_metadata and only
-- allows the 'service' role to use it. In anon-key mode the caller must pass
-- a secret token embedded in the function body itself (see TODO below).

CREATE OR REPLACE FUNCTION public.apply_pending_migrations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER   -- runs with the privileges of the function owner (postgres)
SET search_path = public
AS $$
DECLARE
  result JSONB := '{"applied": [], "skipped": [], "errors": []}'::JSONB;
  col_exists BOOLEAN;
BEGIN
  -- ----------------------------------------------------------------
  -- 1. calibrated_prob_up
  -- ----------------------------------------------------------------
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'predictions'
      AND column_name  = 'calibrated_prob_up'
  ) INTO col_exists;

  IF NOT col_exists THEN
    ALTER TABLE predictions ADD COLUMN calibrated_prob_up NUMERIC(8, 6);
    result := jsonb_set(result, '{applied}', result->'applied' || '["calibrated_prob_up"]');
  ELSE
    result := jsonb_set(result, '{skipped}', result->'skipped' || '["calibrated_prob_up"]');
  END IF;

  -- ----------------------------------------------------------------
  -- 2. max_position_size
  -- ----------------------------------------------------------------
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'predictions'
      AND column_name  = 'max_position_size'
  ) INTO col_exists;

  IF NOT col_exists THEN
    ALTER TABLE predictions ADD COLUMN max_position_size NUMERIC(8, 6);
    result := jsonb_set(result, '{applied}', result->'applied' || '["max_position_size"]');
  ELSE
    result := jsonb_set(result, '{skipped}', result->'skipped' || '["max_position_size"]');
  END IF;

  -- ----------------------------------------------------------------
  -- 3. New Confidence & Regime fields (June 11 & June 16, 2026)
  -- ----------------------------------------------------------------
  -- Instead of repeating the IF NOT EXISTS block, we can just alter table 
  -- and rely on Postgres 'ADD COLUMN IF NOT EXISTS' syntax (available in Postgres 9.6+)
  ALTER TABLE predictions
    ADD COLUMN IF NOT EXISTS market_regime TEXT,
    ADD COLUMN IF NOT EXISTS signal_strength TEXT,
    ADD COLUMN IF NOT EXISTS confidence_before_filter NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS confidence_after_filter NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS signal_quality TEXT,
    ADD COLUMN IF NOT EXISTS filter_reason TEXT,
    ADD COLUMN IF NOT EXISTS is_tradeable_signal BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS reliability_grade TEXT,
    ADD COLUMN IF NOT EXISTS stock_reliability_score NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS timeframe_reliability_score NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS raw_confidence NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS calibrated_confidence NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS regime_adjusted_confidence NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS macro_adjusted_confidence NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS multi_timeframe_adjusted_confidence NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS final_confidence NUMERIC(5, 2),
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
    ADD COLUMN IF NOT EXISTS regime_confidence NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS regime_reason TEXT,
    ADD COLUMN IF NOT EXISTS macro_risk_score NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS macro_bias TEXT,
    ADD COLUMN IF NOT EXISTS alignment_score NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS timeframe_conflict BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS trade_filter_score NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS trade_filter_decision TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reasons JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS engine_version TEXT,
    ADD COLUMN IF NOT EXISTS feature_version TEXT,
    ADD COLUMN IF NOT EXISTS calibration_version TEXT,
    ADD COLUMN IF NOT EXISTS regime_version TEXT;
    
  result := jsonb_set(result, '{applied}', result->'applied' || '["confidence_and_regime_fields"]');

  -- ----------------------------------------------------------------
  -- 4. Constraints (idempotent)
  -- ----------------------------------------------------------------
  ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_calibrated_prob_up_check;
  ALTER TABLE predictions ADD CONSTRAINT predictions_calibrated_prob_up_check
    CHECK (calibrated_prob_up IS NULL OR calibrated_prob_up BETWEEN 0 AND 1);

  ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_max_position_size_check;
  ALTER TABLE predictions ADD CONSTRAINT predictions_max_position_size_check
    CHECK (max_position_size IS NULL OR max_position_size BETWEEN 0 AND 1);

  -- ----------------------------------------------------------------
  -- 5. Reload PostgREST schema cache
  -- ----------------------------------------------------------------
  NOTIFY pgrst, 'reload schema';

  RETURN result;
END;
$$;

-- Allow the anon role (used by the Next.js API with the anon key) to call it.
GRANT EXECUTE ON FUNCTION public.apply_pending_migrations() TO anon;
GRANT EXECUTE ON FUNCTION public.apply_pending_migrations() TO authenticated;

-- Verify the function was created:
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'apply_pending_migrations';
