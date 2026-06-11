-- Migration: Add tables for Adaptive Weighting & Regime Detection (Phases 1 & 2)

-- 1. Indicator Performance Table
CREATE TABLE IF NOT EXISTS indicator_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_name TEXT NOT NULL UNIQUE,
  current_weight NUMERIC(6, 2) NOT NULL,
  previous_weight NUMERIC(6, 2) NOT NULL,
  accuracy_score NUMERIC(5, 2) NOT NULL,
  reliability_score NUMERIC(5, 2) NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- 2. Market Regimes Table
CREATE TABLE IF NOT EXISTS market_regimes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regime_name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  confidence NUMERIC(5, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_market_regimes_name ON market_regimes(regime_name);
