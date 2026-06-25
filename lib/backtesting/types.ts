// ─── Backtesting Lab — Type Definitions ───────────────────────────────────────

export type BacktestTimeframe = '1D' | '7D' | '30D' | '90D' | '365D' | '1Y' | '3Y' | '5Y' | '10Y';
export type BacktestModel = 'V1' | 'V2' | 'V3' | 'REGIME' | 'META' | 'ALL';
export type BacktestStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type PredictionResult = 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT' | 'PENDING';
export type MarketRegime = 'BULL' | 'BEAR' | 'SIDEWAYS' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY' | 'TRENDING' | 'MEAN_REVERTING';

export type StressScenarioKey =
  | 'DOT_COM_CRASH'
  | 'FINANCIAL_CRISIS_2008'
  | 'COVID_CRASH'
  | 'HIGH_INFLATION'
  | 'RATE_HIKING'
  | 'EXTREME_VOLATILITY';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface BacktestConfig {
  id: string;
  name: string;
  timeframe: BacktestTimeframe;
  dataSource?: 'AUTO' | 'STOOQ' | 'YAHOO' | 'ALPHA_VANTAGE';
  startDate?: string;
  endDate?: string;
  models: BacktestModel[];
  tickerMode: 'SINGLE' | 'MULTIPLE' | 'SECTOR' | 'MARKET';
  tickers: string[];
  sector?: string;
  predictionHorizon: '1D' | '7D' | '30D' | '90D';
  initialCapital: number;
  positionSizing: number;
  stopLoss: number;
  takeProfit: number;
  confidenceFilter: number;
  signalStrengthFilter: 'ALL' | 'MODERATE_STRONG' | 'STRONG_ONLY';
  maxTrades: number;
  walkForward: boolean;
  walkForwardConfig?: WalkForwardConfig;
  monteCarloEnabled: boolean;
  monteCarloConfig?: MonteCarloConfig;
  stressTestEnabled: boolean;
  stressScenarios?: StressScenarioKey[];
  createdAt: string;
}

export interface WalkForwardConfig {
  trainYears: number;
  validateMonths: number;
  testMonths: number;
  stepMonths: number;
}

export interface MonteCarloConfig {
  simCount: 10000 | 50000 | 100000 | 250000 | 1000000;
  horizon: number; // trading days
}

// ─── Job Tracking ─────────────────────────────────────────────────────────────

export interface BacktestJob {
  id: string;
  config: BacktestConfig;
  status: BacktestStatus;
  progress: number; // 0-100
  phase: string;
  currentTicker?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  totalTickers: number;
  completedTickers: number;
  logs?: string[];
}

// ─── OHLCV Data ───────────────────────────────────────────────────────────────
export interface OHLCVBar {
  date: string;        // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
  source?: string;
}

// ─── Single Trade Record ──────────────────────────────────────────────────────

export interface BacktestTrade {
  tradeId: string;
  date: string;
  ticker: string;
  model: BacktestModel;
  direction: 'UP' | 'DOWN';
  entryPrice: number;
  exitPrice: number;
  exitDate: string;
  returnPct: number;
  profitAmount: number;
  isWin: boolean;
  regime: MarketRegime;
  exitReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TIME_EXIT';
  confidence: number;
}

// ─── Single Prediction Record (for backtesting) ───────────────────────────────

export interface BacktestPredictionRecord {
  date: string;
  ticker: string;
  model: BacktestModel;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  signalStrength?: 'NO_SIGNAL' | 'WEAK_SIGNAL' | 'MODERATE_SIGNAL' | 'STRONG_SIGNAL';
  predictedReturn: number;
  actualReturn: number;
  result: PredictionResult;
  regime: MarketRegime;
  horizon: string;
  indicators: {
    rsi14: number;
    macdHistogram: number;
    sma200Diff: number;
    atrRatio: number;
  };
}

// ─── Per-Ticker Backtest Result ────────────────────────────────────────────────

export interface TickerBacktestResult {
  ticker: string;
  sector: string;
  
  // Performance
  totalTrades: number;
  winRate: number;
  lossRate: number;
  profitAndLoss: number;
  cagr: number;
  maxDrawdown: number;
  sharpeRatio: number;
  averageWin: number;
  averageLoss: number;
  winLossRatio: number;
  
  // Original Stats
  totalPredictions: number;
  verifiedPredictions: number;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  neutralCount: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  averageError: number;
  medianError: number;
  
  confidenceCalibrationError: number;
  regimeBreakdown: Record<MarketRegime, RegimeStats>;
  timeframeBreakdown: Record<string, number>;
  
  // Trades and curves
  records: BacktestPredictionRecord[];
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  drawdownCurve: DrawdownPoint[];
  
  // Source tracking
  sourceUsed?: string;
  failedSourceLogs?: string[];
}

export interface RegimeStats {
  count: number;
  accuracy: number;
  avgReturn: number;
}

// ─── Walk-Forward ─────────────────────────────────────────────────────────────

export interface WalkForwardWindow {
  index: number;
  trainStart: string;
  trainEnd: string;
  validateStart: string;
  validateEnd: string;
  testStart: string;
  testEnd: string;
}

export interface WalkForwardResult {
  windows: WalkForwardWindowResult[];
  aggregateTestAccuracy: number;
  overfitScore: number; // trainAcc - testAcc (higher = more overfit)
  bestWindow: number;
  worstWindow: number;
}

export interface WalkForwardWindowResult {
  window: WalkForwardWindow;
  trainAccuracy: number;
  validateAccuracy: number;
  testAccuracy: number;
  trainSharpe: number;
  testSharpe: number;
  predictions: BacktestPredictionRecord[];
}

// ─── Monte Carlo ──────────────────────────────────────────────────────────────

export interface MonteCarloResult {
  ticker: string;
  simCount: number;
  horizon: number;
  probGain: number;      // % of sims ending positive
  probLoss: number;      // % of sims ending negative
  expectedReturn: number; // mean final return
  medianReturn: number;
  percentiles: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  varReturn: number;     // Value at Risk (95%)
  cvarReturn: number;    // Conditional VaR (95%)
  riskDistribution: { bucket: string; count: number; pct: number }[];
  completedAt: string;
}

// ─── Stress Test ──────────────────────────────────────────────────────────────

export interface StressScenario {
  key: StressScenarioKey;
  name: string;
  startDate: string;
  endDate: string;
  description: string;
  expectedRegime: MarketRegime;
  historicalSPReturn: number; // known S&P 500 return during this period
}

export interface StressTestResult {
  scenario: StressScenario;
  ticker: string;
  model: BacktestModel;
  accuracy: number;
  maxDrawdown: number;
  avgReturn: number;
  winRate: number;
  sharpe: number;
  predictionCount: number;
  resilience: 'RESILIENT' | 'MODERATE' | 'VULNERABLE'; // relative to baseline
}

// ─── Model Comparison ─────────────────────────────────────────────────────────

export interface ModelComparisonRow {
  model: BacktestModel;
  modelName: string;
  rank: number;
  compositeScore: number;
  accuracy: number;
  winRate: number;
  precision: number;
  recall: number;
  f1Score: number;
  sharpeRatio: number;
  maxDrawdown: number;
  confidenceCalibrationError: number;
  totalPredictions: number;
  bestRegime: MarketRegime;
  worstRegime: MarketRegime;
}

// ─── Accuracy Analytics ───────────────────────────────────────────────────────

export interface AccuracyReport {
  totalPredictions: number;
  verifiedPredictions: number;
  accuracy: number;
  winRate: number;
  lossRate: number;
  precision: number;
  recall: number;
  f1Score: number;
  averageError: number;
  medianError: number;
  maxDrawdown: number;
  sharpeRatio: number;
  sortinorRatio: number;
  confidenceCalibrationError: number;
  calibrationBuckets: CalibrationBucket[];
  equityCurve: EquityPoint[];
  drawdownCurve: DrawdownPoint[];
  beforeFiltering: {
    accuracy: number;
    winLossRatio: number;
    medianError: number;
    predictionCount: number;
  };
  afterFiltering: {
    tradeableAccuracy: number;
    winLossRatio: number;
    medianError: number;
    filteredPredictionCount: number;
    noSignalCount: number;
  };
}

export interface CalibrationBucket {
  confidenceRange: string; // e.g. "60-70"
  predictedProbability: number;
  actualAccuracy: number;
  count: number;
  calibrationError: number;
}

export interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
}

export interface DrawdownPoint {
  date: string;
  drawdown: number;
  underwater: boolean;
}

// ─── Optimization Recommendations ─────────────────────────────────────────────

export interface OptimizationRecommendation {
  indicator: string;
  currentWeight: number;
  recommendedWeight: number;
  changeDirection: 'INCREASE' | 'DECREASE' | 'KEEP';
  changePct: number;
  reason: string;
  expectedImprovementPct: number;
  bestRegime: MarketRegime;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ─── Professional Report ──────────────────────────────────────────────────────

export interface ProfessionalReport {
  jobId: string;
  generatedAt: string;
  config: BacktestConfig;
  summary: {
    totalPredictions: number;
    verifiedPredictions: number;
    overallAccuracy: number;
    bestModel: string;
    bestModelScore: number;
    topPerformingTicker: string;
    worstPerformingTicker: string;
  };
  sections: {
    accuracyByTimeframe: Record<string, number>;
    accuracyByStock: { ticker: string; label: string; verifiedCount: number; accuracy: number; winLossRatio: number; medianError: number; reliabilityGrade: string; warning: string }[];
    accuracyBySector: { sector: string; label: string; verifiedCount: number; accuracy: number; winLossRatio: number; medianError: number; reliabilityGrade: string; warning: string }[];
    confidenceCalibration: CalibrationBucket[];
    confidenceBucketPerformance: CalibrationBucket[];
    winLossRatio: Record<string, { wins: number; losses: number; ratio: number }>;
    drawdownAnalysis: {
      maxDrawdown: number;
      averageDrawdown: number;
      longestDrawdownDays: number;
      recoveryTime: number;
      ulcerIndex: number;
    };
    riskAnalysis: {
      sharpe: number;
      sortino: number;
      calmar: number;
      var95: number;
      cvar95: number;
      beta: number;
      alpha: number;
    };
    filteredMetrics: {
      overallAccuracy: number;
      tradeableAccuracy: number;
      filteredPredictionsCount: number;
      noSignalCount: number;
      winLossRatioAfterFiltering: number;
      accuracyBeforeFiltering: number;
      accuracyAfterFiltering: number;
      medianErrorBeforeFiltering: number;
      medianErrorAfterFiltering: number;
      targetAchieved: boolean;
    };
    failureAnalysis: {
      dimension: string;
      value: string;
      failures: number;
      total: number;
      failureRate: number;
      accuracy: number;
      winLossRatio: number;
      medianError: number;
      reliabilityGrade: string;
      warning: string;
    }[];
    bestPerformingModel: ModelComparisonRow;
    optimizationRecommendations: OptimizationRecommendation[];
  };
  tickerResults: TickerBacktestResult[];
  walkForwardResult?: WalkForwardResult;
  monteCarloResults?: MonteCarloResult[];
  stressTestResults?: StressTestResult[];
  modelComparison?: ModelComparisonRow[];
}

// ─── Stock Universe ───────────────────────────────────────────────────────────

export interface StockInfo {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  marketCap: 'LARGE' | 'MID' | 'SMALL';
}

export const GICS_SECTORS = [
  'Information Technology',
  'Health Care',
  'Financials',
  'Consumer Discretionary',
  'Communication Services',
  'Industrials',
  'Consumer Staples',
  'Energy',
  'Utilities',
  'Real Estate',
  'Materials',
] as const;

export type GICSSector = typeof GICS_SECTORS[number];
