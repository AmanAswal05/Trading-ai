export type RejectionReason = 
  | 'WEAK_SIGNAL'
  | 'BELOW_CONFIDENCE_THRESHOLD'
  | 'LOW_ALIGNMENT_SCORE'
  | 'HIGH_RISK_SCORE'
  | 'POOR_MARKET_REGIME'
  | 'SIDEWAYS_HIGH_VOLATILITY'
  | 'LOW_VOLUME_QUALITY'
  | 'LOW_HISTORICAL_STOCK_ACCURACY'
  | 'LOW_HISTORICAL_SECTOR_ACCURACY'
  | 'TIMEFRAME_CONFLICT'
  | 'INVALID_DATA'
  | 'MISSING_ACTUAL_PRICE'
  | 'BELOW_TRADE_FILTER_THRESHOLD'
  | 'UNKNOWN_REASON';

export interface TradeFilterInput {
  signalType: 'NO_SIGNAL' | 'WEAK_SIGNAL' | 'MODERATE_SIGNAL' | 'STRONG_SIGNAL';
  calibratedConfidence: number;
  alignmentScore: number;
  timeframeConflict: boolean;
  marketRegime: {
    trendRegime: string;
    volatilityRegime: string;
  };
  riskScore: number; // 0 to 100
  volumeQuality: number; // 0 to 100
  historicalStockAccuracy?: number; // 0 to 100
  historicalSectorAccuracy?: number; // 0 to 100
  hasActualComparisonTarget: boolean;
  hasDataQualityWarning: boolean;
}

export interface TradeFilterThresholds {
  minConfidence: number; // e.g. 65
  minAlignment: number;  // e.g. 65
  minTradeFilterScore: number; // e.g. 65
  maxRiskScore: number; // e.g. 80
}

export interface TradeFilterOutput {
  isTradeable: boolean;
  tradeFilterScore: number;
  tradeFilterDecision: 'APPROVED' | 'REJECTED';
  rejectionReasons: RejectionReason[];
}

export function calculateTradeFilterScore(input: TradeFilterInput): number {
  let score = 0;
  
  // Weights
  // Calibrated Confidence: 30%
  // Multi-Timeframe Alignment: 20%
  // Regime Quality: 15%
  // Risk Score: 15% (inverted)
  // Volume/Liquidity Quality: 10%
  // Historical Performance Context: 10%

  score += (Math.min(100, Math.max(0, input.calibratedConfidence)) / 100) * 30;
  score += (Math.min(100, Math.max(0, input.alignmentScore)) / 100) * 20;

  let regimeScore = 50;
  if (input.marketRegime.trendRegime === 'BULL_MARKET' && input.marketRegime.volatilityRegime === 'LOW_VOLATILITY') regimeScore = 100;
  else if (input.marketRegime.trendRegime === 'BULL_MARKET') regimeScore = 80;
  else if (input.marketRegime.trendRegime === 'BEAR_MARKET') regimeScore = 0;
  else if (input.marketRegime.trendRegime === 'SIDEWAYS_MARKET' && input.marketRegime.volatilityRegime === 'HIGH_VOLATILITY') regimeScore = 20;
  score += (regimeScore / 100) * 15;

  const invertedRisk = 100 - Math.min(100, Math.max(0, input.riskScore));
  score += (invertedRisk / 100) * 15;

  score += (Math.min(100, Math.max(0, input.volumeQuality)) / 100) * 10;

  const stockAcc = input.historicalStockAccuracy ?? 50;
  const sectorAcc = input.historicalSectorAccuracy ?? 50;
  const histContext = (stockAcc + sectorAcc) / 2;
  score += (Math.min(100, Math.max(0, histContext)) / 100) * 10;

  return Math.round(score);
}

export function evaluateTradeability(input: TradeFilterInput, thresholds: TradeFilterThresholds): TradeFilterOutput {
  const reasons: RejectionReason[] = [];
  const tradeFilterScore = calculateTradeFilterScore(input);

  // Simplified rules to match Python backend
  if (input.calibratedConfidence < thresholds.minConfidence) reasons.push('BELOW_CONFIDENCE_THRESHOLD');
  if (input.historicalStockAccuracy !== undefined && input.historicalStockAccuracy < 55) reasons.push('LOW_HISTORICAL_STOCK_ACCURACY');
  if (input.marketRegime.trendRegime === 'BEAR_MARKET') reasons.push('POOR_MARKET_REGIME');
  
  // Use risk score as a proxy for poor win/loss ratio (since TS doesn't have raw WLR)
  if (input.riskScore > thresholds.maxRiskScore) reasons.push('HIGH_RISK_SCORE');

  if (tradeFilterScore < thresholds.minTradeFilterScore) {
    if (reasons.length === 0) reasons.push('BELOW_TRADE_FILTER_THRESHOLD');
  }

  const isTradeable = reasons.length === 0;

  return {
    isTradeable,
    tradeFilterScore,
    tradeFilterDecision: isTradeable ? 'APPROVED' : 'REJECTED',
    rejectionReasons: reasons
  };
}
