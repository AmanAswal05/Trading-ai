export type CurrencyCode = 'USD' | 'INR' | 'EUR' | 'GBP' | 'AED' | 'CAD' | 'AUD' | 'JPY';
export type SignalStrength = 'NO_SIGNAL' | 'WEAK_SIGNAL' | 'MODERATE_SIGNAL' | 'STRONG_SIGNAL';

export interface HistoricalQuote {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  rsi14: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  atr14: number;
  stochasticK: number;
  stochasticD: number;
  williamsR: number;
  obv: number;
  avgVolume20?: number;
}

export interface StockQuote {
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  changePercent: number;
  previousClose: number;
}

export interface StockData {
  ticker: string;
  name: string;
  exchange: string;
  currency: string;
  quote: StockQuote;
  history: HistoricalQuote[];
  indicators: TechnicalIndicators;
  dataQuality?: import('../lib/data-quality').DataQualityReport;
  source?: 'live' | 'cached' | 'mock' | 'fallback';
}

export interface PredictionMetrics {
  bullish_probability: number;
  bearish_probability: number;
  neutral_probability: number;
  bear_case_return: number;
  base_case_return: number;
  bull_case_return: number;
  risk_score: number;
  volatility_score: number;
}

export interface PredictionExplanation {
  rsi_contribution: number;
  macd_contribution: number;
  trend_contribution: number;
  volume_contribution: number;
  volatility_contribution: number;
  sentiment_contribution: number;
  support_resistance_contribution: number;
  ai_reasoning_summary: string;
}

export interface PredictionResult {
  ticker: string;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  targetLow: number;
  targetHigh: number;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH';
  signalBreakdown: {
    trend: number;
    momentum: number;
    volatility: number;
    volume: number;
  };
  summary: string;
  generatedAt: string;
  modelVersion?: 'V1' | 'V2' | 'V3';
  predictedPrice?: number;
  timeframe?: string;
  dataQualityScore?: number;
  // Advanced Trust & Explainability Fields
  probabilities?: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  expectedReturns?: {
    bear: number;
    base: number;
    bull: number;
  };
  riskScore?: number;
  volatilityScore?: number;
  explainability?: {
    rsiContribution: number;
    macdContribution: number;
    trendContribution: number;
    volumeContribution: number;
    volatilityContribution: number;
    sentimentContribution: number;
    supportResistanceContribution: number;
    aiReasoningSummary: string;
  };
  similarSetup?: {
    successRate: number;
    verifiedCount: number;
  };
  regime?: string;
  regimeConfidence?: number;
  regimeReason?: string;
  regimeAdjustedConfidence?: number;
  signalStrength?: SignalStrength;
  reliabilityGrade?: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
  reliabilityWarnings?: string[];
  confidenceBeforeFilter?: number;
  confidenceAfterFilter?: number;
  signalQuality?: string;
  filterReason?: string;
  isTradeableSignal?: boolean;
  maxPositionSize?: number;
  stockReliabilityScore?: number;
  timeframeReliabilityScore?: number;
  featureQualityScore?: number;
  featureExplanations?: {
    topBullish: string[];
    topBearish: string[];
    conflicting: string[];
    missingWeak: string[];
    historicalWeightingContext?: string;
  };
  insufficientEdge?: boolean;
  tradeFilterScore?: number;
  tradeFilterDecision?: string;
  rejectionReasons?: string[];
  macroContext?: {
    riskScore: number;
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    niftyTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    niftyStrength: number;
    vixLevel: number;
  };
  safetyModeActive?: boolean;
  confidenceBreakdown?: {
    raw: number;
    calibrated: number;
    final: number;
    capReason?: string;
  };
}

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface ExchangeRates {
  base: string;
  rates: Record<CurrencyCode, number>;
  fetchedAt: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  ticker: string;
  added_at: string;
  price?: number;
  changePercent?: number;
  history?: HistoricalQuote[];
}
