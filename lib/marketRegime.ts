/* eslint-disable @typescript-eslint/no-unused-vars */
import { HistoricalQuote, TechnicalIndicators } from '../types/stock';

export type TrendRegime = 'BULL_MARKET' | 'BEAR_MARKET' | 'SIDEWAYS_MARKET';
export type VolatilityRegime = 'HIGH_VOLATILITY' | 'NORMAL_VOLATILITY' | 'LOW_VOLATILITY';

export interface MarketRegimeClassification {
  trendRegime: TrendRegime;
  volatilityRegime: VolatilityRegime;
  regimeConfidence: number; // 0-1
  regimeReason: string;
}

export function detectMarketRegime(
  indicators: TechnicalIndicators,
  price: number,
  context?: { history?: HistoricalQuote[]; volume?: number }
): MarketRegimeClassification {
  const {
    sma20,
    sma50,
    sma200,
    atr14,
  } = indicators;

  // Trend detection
  const recent = context?.history?.slice(-30) ?? [];
  let ema20Slope = 0;
  let ema50Slope = 0;

  if (recent.length >= 5) {
    const p1 = recent[recent.length - 1].close;
    const p5 = recent[recent.length - 5].close;
    ema20Slope = (p1 - p5) / p5; 
    ema50Slope = ema20Slope; 
  }

  let trendRegime: TrendRegime = 'SIDEWAYS_MARKET';
  const trendReasons: string[] = [];

  const isBull = price > sma200 && sma50 > sma200 && price > sma50;
  const isBear = price < sma200 && sma50 < sma200 && price < sma50;

  if (isBull) {
    trendRegime = 'BULL_MARKET';
    trendReasons.push('Close > SMA200');
    trendReasons.push('SMA50 > SMA200');
    trendReasons.push('Positive price trend');
  } else if (isBear) {
    trendRegime = 'BEAR_MARKET';
    trendReasons.push('Close < SMA200');
    trendReasons.push('SMA50 < SMA200');
    trendReasons.push('Negative price trend');
  } else {
    trendRegime = 'SIDEWAYS_MARKET';
    trendReasons.push('Price oscillating around moving averages');
  }

  // Volatility detection
  let volatilityRegime: VolatilityRegime = 'NORMAL_VOLATILITY';
  const atrRatio = atr14 / price;
  const volReasons: string[] = [];

  if (atrRatio > 0.035) { 
    volatilityRegime = 'HIGH_VOLATILITY';
    volReasons.push(`ATR ratio is high (${(atrRatio * 100).toFixed(2)}%)`);
  } else if (atrRatio < 0.012) {
    volatilityRegime = 'LOW_VOLATILITY';
    volReasons.push(`ATR ratio is low (${(atrRatio * 100).toFixed(2)}%)`);
  } else {
    volatilityRegime = 'NORMAL_VOLATILITY';
    volReasons.push(`ATR ratio is normal (${(atrRatio * 100).toFixed(2)}%)`);
  }

  // Confidence calculation
  let confidence = 0.5;
  if (trendRegime === 'BULL_MARKET' && price > sma20 && sma20 > sma50) {
    confidence += 0.25;
  } else if (trendRegime === 'BEAR_MARKET' && price < sma20 && sma20 < sma50) {
    confidence += 0.25;
  } else if (trendRegime === 'SIDEWAYS_MARKET' && Math.abs(price - sma200) / sma200 < 0.02) {
    confidence += 0.2;
  }

  if (volatilityRegime === 'HIGH_VOLATILITY' && atrRatio > 0.05) {
    confidence += 0.1;
  } else if (volatilityRegime === 'LOW_VOLATILITY' && atrRatio < 0.008) {
    confidence += 0.1;
  }

  const reasonText = [...trendReasons, ...volReasons].join(', ');

  return {
    trendRegime,
    volatilityRegime,
    regimeConfidence: Math.min(1, Math.max(0, confidence)),
    regimeReason: reasonText,
  };
}
