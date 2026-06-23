-- StockPredict AI Pro Schema Migrations

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT,
  theme_preference TEXT NOT NULL DEFAULT 'Follow System', -- 'Light Mode', 'Dark Mode', 'Follow System'
  currency_preference TEXT NOT NULL DEFAULT 'INR', -- 'USD', 'INR', 'EUR', etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  plan_name TEXT NOT NULL DEFAULT 'Free', -- 'Free', 'Pro'
  billing_cycle TEXT NOT NULL DEFAULT 'None', -- 'Weekly', 'Monthly', 'Yearly', 'None'
  status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Expired', 'Cancelled'
  start_date TIMESTAMPTZ DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  trial_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Stock Searches Table (Limit & usage tracking)
CREATE TABLE IF NOT EXISTS stock_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Nullable for guest tracking if needed
  stock_symbol TEXT NOT NULL,
  searched_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Watchlists Table
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stock_symbol TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, stock_symbol)
);

-- 5. Portfolios Table
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stock_symbol TEXT NOT NULL,
  quantity NUMERIC(12, 4) NOT NULL,
  buy_price NUMERIC(12, 4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, stock_symbol)
);

-- 6. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL,
  payment_provider TEXT NOT NULL, -- 'Razorpay', 'Stripe'
  status TEXT NOT NULL, -- 'Success', 'Failed', 'Pending'
  transaction_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  theme TEXT NOT NULL DEFAULT 'Follow System',
  currency TEXT NOT NULL DEFAULT 'INR',
  notifications BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for rapid query performance
CREATE INDEX IF NOT EXISTS idx_stock_searches_user_id ON stock_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

-- 8. Predictions Table
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ticker TEXT NOT NULL,
  prediction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  timeframe TEXT NOT NULL,
  current_price NUMERIC(12, 4) NOT NULL,
  predicted_price NUMERIC(12, 4) NOT NULL,
  predicted_direction TEXT NOT NULL,
  confidence_score NUMERIC(5, 2) NOT NULL,
  model_version TEXT NOT NULL,
  market_regime TEXT,
  signal_strength TEXT,
  confidence_before_filter NUMERIC(5, 2),
  confidence_after_filter NUMERIC(5, 2),
  signal_quality TEXT,
  filter_reason TEXT,
  is_tradeable_signal BOOLEAN DEFAULT false,
  max_position_size NUMERIC(8, 6),
  calibrated_prob_up NUMERIC(8, 6),
  reliability_grade TEXT,
  stock_reliability_score NUMERIC(5, 2),
  timeframe_reliability_score NUMERIC(5, 2),
  status TEXT NOT NULL DEFAULT 'PENDING',
  verification_date TIMESTAMPTZ,
  actual_price NUMERIC(12, 4),
  actual_direction TEXT,
  prediction_result TEXT,
  error_percentage NUMERIC(8, 4),
  raw_confidence NUMERIC(5, 2),
  calibrated_confidence NUMERIC(5, 2),
  regime_adjusted_confidence NUMERIC(5, 2),
  macro_adjusted_confidence NUMERIC(5, 2),
  multi_timeframe_adjusted_confidence NUMERIC(5, 2),
  final_confidence NUMERIC(5, 2),
  raw_probability NUMERIC(8, 6),
  calibrated_probability NUMERIC(8, 6),
  final_probability NUMERIC(8, 6),
  calibrated_prob_down NUMERIC(8, 6),
  raw_prob_up NUMERIC(8, 6),
  raw_prob_down NUMERIC(8, 6),
  ensemble_prob_up NUMERIC(8, 6),
  ensemble_prob_down NUMERIC(8, 6),
  final_prob_up NUMERIC(8, 6),
  final_prob_down NUMERIC(8, 6),
  trend_regime TEXT,
  volatility_regime TEXT,
  regime_confidence NUMERIC(5, 2),
  regime_reason TEXT,
  macro_risk_score NUMERIC(5, 2),
  macro_bias TEXT,
  alignment_score NUMERIC(5, 2),
  timeframe_conflict BOOLEAN DEFAULT FALSE,
  trade_filter_score NUMERIC(5, 2),
  trade_filter_decision TEXT,
  rejection_reasons JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_ticker ON predictions(ticker);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);

-- 9. Prediction Metrics Table
CREATE TABLE IF NOT EXISTS prediction_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  bullish_probability NUMERIC(5, 2) NOT NULL,
  bearish_probability NUMERIC(5, 2) NOT NULL,
  neutral_probability NUMERIC(5, 2) NOT NULL,
  bear_case_return NUMERIC(8, 4) NOT NULL,
  base_case_return NUMERIC(8, 4) NOT NULL,
  bull_case_return NUMERIC(8, 4) NOT NULL,
  risk_score NUMERIC(4, 2) NOT NULL,
  volatility_score NUMERIC(4, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Prediction Explanations Table
CREATE TABLE IF NOT EXISTS prediction_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  rsi_contribution NUMERIC(5, 2) NOT NULL,
  macd_contribution NUMERIC(5, 2) NOT NULL,
  trend_contribution NUMERIC(5, 2) NOT NULL,
  volume_contribution NUMERIC(5, 2) NOT NULL,
  volatility_contribution NUMERIC(5, 2) NOT NULL,
  sentiment_contribution NUMERIC(5, 2) NOT NULL,
  support_resistance_contribution NUMERIC(5, 2) NOT NULL,
  ai_reasoning_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Model Versions Table
CREATE TABLE IF NOT EXISTS model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT UNIQUE NOT NULL,
  accuracy NUMERIC(5, 2) NOT NULL,
  error_rate NUMERIC(5, 2) NOT NULL,
  win_rate NUMERIC(5, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- 12. Confidence Calibration Table
CREATE TABLE IF NOT EXISTS confidence_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version TEXT NOT NULL,
  confidence_bucket TEXT NOT NULL,
  expected_accuracy NUMERIC(5, 2) NOT NULL,
  actual_accuracy NUMERIC(5, 2) NOT NULL,
  total_predictions INTEGER NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Accuracy Reports Table
CREATE TABLE IF NOT EXISTS accuracy_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeframe TEXT NOT NULL,
  overall_accuracy NUMERIC(5, 2) NOT NULL,
  average_error NUMERIC(5, 2) NOT NULL,
  median_error NUMERIC(5, 2) NOT NULL,
  win_loss_ratio NUMERIC(5, 2) NOT NULL,
  sharpe_score NUMERIC(5, 2) NOT NULL,
  model_drift NUMERIC(5, 2) NOT NULL,
  prediction_volume INTEGER NOT NULL,
  verified_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Trust Metrics Table
CREATE TABLE IF NOT EXISTS trust_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verified_accuracy NUMERIC(5, 2) NOT NULL,
  verified_prediction_count INTEGER NOT NULL,
  average_error NUMERIC(5, 2) NOT NULL,
  model_last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_source_status TEXT NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for new tables
CREATE INDEX IF NOT EXISTS idx_prediction_metrics_pred_id ON prediction_metrics(prediction_id);
CREATE INDEX IF NOT EXISTS idx_prediction_explanations_pred_id ON prediction_explanations(prediction_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_metrics_unique_pred_id ON prediction_metrics(prediction_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_explanations_unique_pred_id ON prediction_explanations(prediction_id);

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_max_position_size_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_max_position_size_check
  CHECK (max_position_size IS NULL OR max_position_size BETWEEN 0 AND 1);

ALTER TABLE predictions DROP CONSTRAINT IF EXISTS predictions_calibrated_prob_up_check;
ALTER TABLE predictions ADD CONSTRAINT predictions_calibrated_prob_up_check
  CHECK (calibrated_prob_up IS NULL OR calibrated_prob_up BETWEEN 0 AND 1);
