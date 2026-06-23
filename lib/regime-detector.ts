import { HistoricalQuote, TechnicalIndicators } from '../types/stock';

export type MarketRegime = 'BULL_TREND' | 'BEAR_TREND' | 'SIDEWAYS_CHOPPY' | 'HIGH_VOLATILITY' | 'LOW_LIQUIDITY' | 'RECOVERY_REVERSAL';

export interface RegimeClassification {
  regime: MarketRegime;
  confidence: number;       // 0-100
  reason: string;
  secondary_regime?: MarketRegime;
  indicators_used: string[];
}

/**
 * Detects the current market regime based on technical indicators and price.
 */
export function detectRegime(
  indicators: TechnicalIndicators,
  price: number,
  context?: { history?: HistoricalQuote[]; volume?: number }
): RegimeClassification {
  const {
    rsi14,
    sma50,
    sma200,
    ema12,
    ema26,
    atr14,
  } = indicators;

  const recent = context?.history?.slice(-50) ?? [];
  const firstClose = recent[0]?.close;
  const trendSlope = firstClose ? (price - firstClose) / firstClose / Math.max(1, recent.length - 1) : 0;
  const peak = recent.length > 0 ? Math.max(...recent.map(quote => quote.close)) : price;
  const trough = recent.length > 0 ? Math.min(...recent.map(quote => quote.close)) : price;
  
  const drawdown = peak > 0 ? (peak - price) / peak : 0;
  const bounce = trough > 0 ? (price - trough) / trough : 0;

  const averageVolume = recent.length > 0 ? recent.reduce((sum, quote) => sum + quote.volume, 0) / recent.length : 0;
  
  const indicatorsUsed = ['RSI14', 'SMA50', 'SMA200', 'ATR14', 'trendSlope', 'volumeConfirmation', 'drawdown', 'bounce'];

  const atrRatio = atr14 / price;
  const sma50_200_diff = (sma50 - sma200) / sma200;
  
  // 1. LOW LIQUIDITY
  if (averageVolume > 0 && context?.volume && context.volume < averageVolume * 0.3) {
    const confidence = Math.min(100, Math.round(100 - (context.volume / averageVolume) * 100));
    return {
      regime: 'LOW_LIQUIDITY',
      confidence,
      reason: 'Volume is critically low compared to historical averages, indicating lack of market interest.',
      indicators_used: indicatorsUsed,
    };
  }

  // 2. HIGH VOLATILITY
  if (atrRatio > 0.04) {
    const confidence = Math.min(100, Math.round((atrRatio / 0.04) * 50 + 50));
    return {
      regime: 'HIGH_VOLATILITY',
      confidence,
      reason: `Average True Range is extreme (${(atrRatio*100).toFixed(1)}% of price), indicating erratic price swings.`,
      secondary_regime: price > sma200 ? 'BULL_TREND' : 'BEAR_TREND',
      indicators_used: indicatorsUsed,
    };
  }

  // 3. RECOVERY / REVERSAL
  if (drawdown > 0.15 && bounce > 0.05 && rsi14 > 40 && ema12 > ema26) {
    const confidence = Math.min(100, Math.round(50 + (bounce * 100) * 2));
    return {
      regime: 'RECOVERY_REVERSAL',
      confidence,
      reason: `Price bounced strongly (${(bounce*100).toFixed(1)}%) from a deep drawdown (${(drawdown*100).toFixed(1)}%) with short-term EMA cross.`,
      secondary_regime: 'BEAR_TREND',
      indicators_used: indicatorsUsed,
    };
  }

  // 4. BULL TREND
  const isBull = price > sma200 && price > sma50 && ema12 > ema26 && trendSlope > 0;
  if (isBull) {
    const emaDiff = (ema12 - ema26) / ema26;
    const confidence = Math.min(100, Math.round(60 + Math.min(40, emaDiff * 1000 + (sma50_200_diff * 100))));
    return {
      regime: 'BULL_TREND',
      confidence,
      reason: 'Price is above 50 & 200 SMAs with positive trend slope and short-term momentum.',
      secondary_regime: atrRatio > 0.025 ? 'HIGH_VOLATILITY' : undefined,
      indicators_used: indicatorsUsed,
    };
  }

  // 5. BEAR TREND
  const isBear = price < sma200 && price < sma50 && ema12 < ema26 && trendSlope < 0;
  if (isBear) {
    const emaDiff = (ema26 - ema12) / ema26;
    const confidence = Math.min(100, Math.round(60 + Math.min(40, emaDiff * 1000 - (sma50_200_diff * 100))));
    return {
      regime: 'BEAR_TREND',
      confidence,
      reason: 'Price is below 50 & 200 SMAs with negative trend slope and weak short-term momentum.',
      secondary_regime: atrRatio > 0.025 ? 'HIGH_VOLATILITY' : undefined,
      indicators_used: indicatorsUsed,
    };
  }

  // 6. SIDEWAYS / CHOPPY
  const confidence = Math.max(50, Math.min(90, 100 - (Math.abs(trendSlope) * 10000)));
  return {
    regime: 'SIDEWAYS_CHOPPY',
    confidence,
    reason: 'Moving averages are flat, price is ranging, and no clear momentum direction is established.',
    indicators_used: indicatorsUsed,
  };
}

/**
 * Returns human-readable label for a market regime.
 */
export function getRegimeLabel(regime: MarketRegime): string {
  switch (regime) {
    case 'BULL_TREND': return 'Bullish Trend';
    case 'BEAR_TREND': return 'Bearish Trend';
    case 'SIDEWAYS_CHOPPY': return 'Sideways / Choppy';
    case 'HIGH_VOLATILITY': return 'High Volatility';
    case 'LOW_LIQUIDITY': return 'Low Liquidity';
    case 'RECOVERY_REVERSAL': return 'Recovery / Reversal';
    default: return 'Unknown Regime';
  }
}

