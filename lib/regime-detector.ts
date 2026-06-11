import { TechnicalIndicators } from '../types/stock';

export type MarketRegime = 'BULL' | 'BEAR' | 'SIDEWAYS' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY' | 'TRENDING' | 'MEAN_REVERTING';

export interface RegimeClassification {
  regime: MarketRegime;
  confidence: number;       // 0-100
  secondary_regime?: MarketRegime;
  indicators_used: string[];
}

/**
 * Detects the current market regime based on technical indicators and price.
 * Priority: HIGH_VOLATILITY > MEAN_REVERTING > TRENDING > BULL/BEAR > SIDEWAYS > LOW_VOLATILITY
 */
export function detectRegime(indicators: TechnicalIndicators, price: number): RegimeClassification {
  const {
    rsi14,
    sma50,
    sma200,
    ema12,
    ema26,
    atr14,
    bollingerUpper,
    bollingerLower,
  } = indicators;

  const indicatorsUsed = ['RSI14', 'SMA50', 'SMA200', 'EMA12', 'EMA26', 'ATR14', 'BollingerBands'];

  const atrRatio = atr14 / price;
  const sma50_200_diff = Math.abs(sma50 - sma200) / sma200;
  const sma200_price_diff = Math.abs(price - sma200) / sma200;
  const sma50_price_diff = Math.abs(price - sma50) / sma50;

  // 1. HIGH VOLATILITY
  if (atrRatio > 0.03) {
    const confidence = Math.min(100, Math.round((atrRatio / 0.03) * 60 + 40));
    return {
      regime: 'HIGH_VOLATILITY',
      confidence,
      secondary_regime: price > sma200 ? 'BULL' : 'BEAR',
      indicators_used: indicatorsUsed,
    };
  }

  // 2. MEAN REVERTING
  const nearUpperBand = price >= bollingerUpper * 0.98;
  const nearLowerBand = price <= bollingerLower * 1.02;
  if ((rsi14 > 70 || rsi14 < 30) && (nearUpperBand || nearLowerBand)) {
    const rsiConfidence = rsi14 > 70 ? (rsi14 - 70) * 3.33 : (30 - rsi14) * 3.33;
    const confidence = Math.min(100, Math.round(50 + rsiConfidence));
    return {
      regime: 'MEAN_REVERTING',
      confidence,
      secondary_regime: rsi14 > 70 ? 'BEAR' : 'BULL', // expectation to revert
      indicators_used: indicatorsUsed,
    };
  }

  // 3. TRENDING
  if (sma50_200_diff > 0.05) {
    const confidence = Math.min(100, Math.round((sma50_200_diff / 0.05) * 50 + 50));
    return {
      regime: 'TRENDING',
      confidence,
      secondary_regime: sma50 > sma200 ? 'BULL' : 'BEAR',
      indicators_used: indicatorsUsed,
    };
  }

  // 4. BULL/BEAR
  const isBull = price > sma200 && price > sma50 && ema12 > ema26;
  const isBear = price < sma200 && price < sma50 && ema12 < ema26;
  if (isBull) {
    const emaDiff = (ema12 - ema26) / ema26;
    const confidence = Math.min(100, Math.round(60 + Math.min(40, emaDiff * 1000)));
    return {
      regime: 'BULL',
      confidence,
      secondary_regime: atrRatio > 0.02 ? 'HIGH_VOLATILITY' : 'LOW_VOLATILITY',
      indicators_used: indicatorsUsed,
    };
  }
  if (isBear) {
    const emaDiff = (ema26 - ema12) / ema26;
    const confidence = Math.min(100, Math.round(60 + Math.min(40, emaDiff * 1000)));
    return {
      regime: 'BEAR',
      confidence,
      secondary_regime: atrRatio > 0.02 ? 'HIGH_VOLATILITY' : 'LOW_VOLATILITY',
      indicators_used: indicatorsUsed,
    };
  }

  // 5. SIDEWAYS
  if (sma200_price_diff < 0.02 && sma50_price_diff < 0.015) {
    const confidence = Math.round(80 - (sma200_price_diff * 1000 + sma50_price_diff * 1000) / 2);
    return {
      regime: 'SIDEWAYS',
      confidence: Math.max(50, confidence),
      secondary_regime: 'LOW_VOLATILITY',
      indicators_used: indicatorsUsed,
    };
  }

  // 6. LOW VOLATILITY
  if (atrRatio < 0.01) {
    const confidence = Math.min(100, Math.round((0.01 / (atrRatio || 0.001)) * 60 + 40));
    return {
      regime: 'LOW_VOLATILITY',
      confidence,
      secondary_regime: 'SIDEWAYS',
      indicators_used: indicatorsUsed,
    };
  }

  // Default Fallback
  return {
    regime: 'SIDEWAYS',
    confidence: 50,
    indicators_used: indicatorsUsed,
  };
}

/**
 * Returns human-readable label for a market regime.
 */
export function getRegimeLabel(regime: MarketRegime): string {
  switch (regime) {
    case 'BULL': return 'Bull Market';
    case 'BEAR': return 'Bear Market';
    case 'SIDEWAYS': return 'Sideways Consolidation';
    case 'HIGH_VOLATILITY': return 'High Volatility Regime';
    case 'LOW_VOLATILITY': return 'Low Volatility Regime';
    case 'TRENDING': return 'Strongly Trending Market';
    case 'MEAN_REVERTING': return 'Mean Reverting (Overextended)';
    default: return 'Unknown Regime';
  }
}
