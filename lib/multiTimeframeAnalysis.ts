/* eslint-disable @typescript-eslint/no-unused-vars */
import { HistoricalQuote } from '../types/stock';
import { EMA, RSI, MACD } from 'technicalindicators';

export type TrendDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface TimeframeAnalysis {
  trendDirection: TrendDirection;
  trendStrength: number; // 0 to 1
  momentumState: TrendDirection;
}

export interface MultiTimeframeResult {
  alignmentScore: number; // 0 to 100
  alignmentDirection: TrendDirection;
  timeframeAgreementPercent: number; // 0 to 100
  alignmentConfidence: number; // 0 to 100
  timeframeConflict: boolean;
  conflictReason?: string;
  higherTimeframeTrend: TrendDirection;
  primaryTimeframeTrend: TrendDirection;
  lowerTimeframeMomentum: TrendDirection;
}

/**
 * Resamples daily bars into higher timeframe bars.
 */
export function resampleBars(bars: HistoricalQuote[], timeframe: 'W' | 'M'): HistoricalQuote[] {
  const resampled: HistoricalQuote[] = [];
  if (bars.length === 0) return resampled;

  let currentBar: Partial<HistoricalQuote> | null = null;
  let currentPeriodKey = '';

  for (const bar of bars) {
    const date = new Date(bar.date);
    let periodKey: string;

    if (timeframe === 'W') {
      // Get week number (rough approximation using UTC)
      const firstDayOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
      const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
      const period = Math.ceil((pastDaysOfYear + firstDayOfYear.getUTCDay() + 1) / 7);
      periodKey = `${date.getUTCFullYear()}-W${period}`;
    } else {
      // Month
      periodKey = `${date.getUTCFullYear()}-M${date.getUTCMonth() + 1}`;
    }

    if (currentBar === null || currentPeriodKey !== periodKey) {
      if (currentBar) {
        resampled.push(currentBar as HistoricalQuote);
      }
      currentPeriodKey = periodKey;
      currentBar = {
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      };
    } else {
      currentBar.high = Math.max(currentBar.high!, bar.high);
      currentBar.low = Math.min(currentBar.low!, bar.low);
      currentBar.close = bar.close;
      currentBar.volume! += bar.volume;
      currentBar.date = bar.date; // Use the end of the period date
    }
  }

  if (currentBar) {
    resampled.push(currentBar as HistoricalQuote);
  }

  return resampled;
}

/**
 * Analyzes a specific timeframe's bars to determine trend and momentum.
 */
export function analyzeTimeframe(bars: HistoricalQuote[], isLower: boolean = false): TimeframeAnalysis {
  if (bars.length < 50) {
    return { trendDirection: 'NEUTRAL', trendStrength: 0, momentumState: 'NEUTRAL' };
  }

  const closes = bars.map(b => b.close);
  const currentPrice = closes[closes.length - 1];

  // Moving Averages
  const ema20Arr = EMA.calculate({ values: closes, period: 20 });
  const ema50Arr = EMA.calculate({ values: closes, period: 50 });
  
  const ema20 = ema20Arr.length > 0 ? ema20Arr[ema20Arr.length - 1] : currentPrice;
  const ema50 = ema50Arr.length > 0 ? ema50Arr[ema50Arr.length - 1] : currentPrice;

  // RSI
  const rsiPeriod = isLower ? 5 : 14; // Use faster RSI for lower timeframe
  const rsiArr = RSI.calculate({ values: closes, period: rsiPeriod });
  const rsi = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : 50;

  let trendDirection: TrendDirection = 'NEUTRAL';
  let trendStrength = 0;
  let momentumState: TrendDirection = 'NEUTRAL';

  // Determine Trend
  if (ema20 > ema50 && currentPrice > ema20) {
    trendDirection = 'BULLISH';
    trendStrength = Math.min(1, (currentPrice - ema50) / ema50 * 10);
  } else if (ema20 < ema50 && currentPrice < ema20) {
    trendDirection = 'BEARISH';
    trendStrength = Math.min(1, (ema50 - currentPrice) / ema50 * 10);
  }

  // Determine Momentum
  if (rsi > 60) momentumState = 'BULLISH';
  else if (rsi < 40) momentumState = 'BEARISH';

  return { trendDirection, trendStrength, momentumState };
}

/**
 * Calculates alignment across Higher, Primary, and Lower timeframes.
 */
export function calculateAlignment(
  higher: TimeframeAnalysis,
  primary: TimeframeAnalysis,
  lower: TimeframeAnalysis
): MultiTimeframeResult {
  let score = 50;
  let agreementCount = 0;
  let conflict = false;
  let conflictReason = '';

  const directions = [higher.trendDirection, primary.trendDirection, lower.momentumState];
  const bulls = directions.filter(d => d === 'BULLISH').length;
  const bears = directions.filter(d => d === 'BEARISH').length;

  let alignmentDirection: TrendDirection = 'NEUTRAL';

  if (bulls >= 2) alignmentDirection = 'BULLISH';
  if (bears >= 2) alignmentDirection = 'BEARISH';

  // Detect Conflicts
  if (higher.trendDirection === 'BULLISH' && primary.trendDirection === 'BEARISH') {
    conflict = true;
    conflictReason = 'Higher timeframe is Bullish, but Primary is Bearish.';
    score = 30;
  } else if (higher.trendDirection === 'BEARISH' && primary.trendDirection === 'BULLISH') {
    conflict = true;
    conflictReason = 'Higher timeframe is Bearish, but Primary is Bullish.';
    score = 30;
  } else if (primary.trendDirection === 'BULLISH' && lower.momentumState === 'BEARISH') {
    score = 60; // Minor conflict
  } else if (primary.trendDirection === 'BEARISH' && lower.momentumState === 'BULLISH') {
    score = 60; // Minor conflict
  } else if (higher.trendDirection === primary.trendDirection && primary.trendDirection !== 'NEUTRAL') {
    score = 80;
    agreementCount += 2;
    if (primary.trendDirection === lower.momentumState) {
      score = 95;
      agreementCount += 1;
    }
  }

  // Factor in trend strength
  if (score >= 80) {
    score += higher.trendStrength * 5;
    score = Math.min(100, score);
  }

  const timeframeAgreementPercent = Math.round((agreementCount / 3) * 100);

  return {
    alignmentScore: Math.round(score),
    alignmentDirection,
    timeframeAgreementPercent,
    alignmentConfidence: score, // Direct map for now
    timeframeConflict: conflict,
    conflictReason: conflictReason || undefined,
    higherTimeframeTrend: higher.trendDirection,
    primaryTimeframeTrend: primary.trendDirection,
    lowerTimeframeMomentum: lower.momentumState,
  };
}
