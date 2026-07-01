import { HistoricalQuote } from '@/types/stock';
import { calculateIndicators } from './indicators';

export type TrendDirection = 'BULLISH' | 'NEUTRAL' | 'BEARISH';

export interface MTFResult {
  dailyTrend: TrendDirection;
  weeklyTrend: TrendDirection;
  monthlyTrend: TrendDirection;
  multiTimeframeScore: number;
}

export function aggregateToWeekly(history: HistoricalQuote[]): HistoricalQuote[] {
  const weekly: Record<string, HistoricalQuote[]> = {};

  for (const quote of history) {
    const d = new Date(quote.date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const weekKey = monday.toISOString().split('T')[0];

    if (!weekly[weekKey]) weekly[weekKey] = [];
    weekly[weekKey].push(quote);
  }

  return Object.keys(weekly).sort().map((key) => {
    const quotes = weekly[key];
    const open = quotes[0].open;
    const close = quotes[quotes.length - 1].close;
    const high = Math.max(...quotes.map((q) => q.high));
    const low = Math.min(...quotes.map((q) => q.low));
    const volume = quotes.reduce((sum, q) => sum + q.volume, 0);

    return { date: key, open, high, low, close, volume };
  });
}

export function aggregateToMonthly(history: HistoricalQuote[]): HistoricalQuote[] {
  const monthly: Record<string, HistoricalQuote[]> = {};

  for (const quote of history) {
    const monthKey = quote.date.substring(0, 7); // YYYY-MM

    if (!monthly[monthKey]) monthly[monthKey] = [];
    monthly[monthKey].push(quote);
  }

  return Object.keys(monthly).sort().map((key) => {
    const quotes = monthly[key];
    const open = quotes[0].open;
    const close = quotes[quotes.length - 1].close;
    const high = Math.max(...quotes.map((q) => q.high));
    const low = Math.min(...quotes.map((q) => q.low));
    const volume = quotes.reduce((sum, q) => sum + q.volume, 0);

    return { date: key + '-01', open, high, low, close, volume };
  });
}

function evaluateTrend(history: HistoricalQuote[], indicators: any): TrendDirection {
  if (!history.length || !indicators) return 'NEUTRAL';
  const last = history[history.length - 1];
  let score = 0;

  if (last.close > indicators.ema20) score++;
  else if (last.close < indicators.ema20) score--;

  if (last.close > indicators.ema50) score++;
  else if (last.close < indicators.ema50) score--;

  if (indicators.ema20 > indicators.ema50) score++;
  else if (indicators.ema20 < indicators.ema50) score--;

  if (indicators.rsi14 > 55) score++;
  else if (indicators.rsi14 < 45) score--;

  if (indicators.macd.histogram > 0) score++;
  else if (indicators.macd.histogram < 0) score--;

  if (score >= 3) return 'BULLISH';
  if (score <= -3) return 'BEARISH';
  return 'NEUTRAL';
}

export function calculateMultiTimeframeConfirmation(history: HistoricalQuote[]): MTFResult {
  const weeklyHistory = aggregateToWeekly(history);
  const monthlyHistory = aggregateToMonthly(history);

  const dailyIndicators = calculateIndicators(history);
  const weeklyIndicators = calculateIndicators(weeklyHistory);
  const monthlyIndicators = calculateIndicators(monthlyHistory);

  const dailyTrend = evaluateTrend(history, dailyIndicators);
  const weeklyTrend = evaluateTrend(weeklyHistory, weeklyIndicators);
  const monthlyTrend = evaluateTrend(monthlyHistory, monthlyIndicators);

  const trends = [dailyTrend, weeklyTrend, monthlyTrend];
  const bullCount = trends.filter((t) => t === 'BULLISH').length;
  const bearCount = trends.filter((t) => t === 'BEARISH').length;

  let multiTimeframeScore = 25; // Default (conflict or neutral)

  const maxAgreement = Math.max(bullCount, bearCount);
  if (maxAgreement === 3) multiTimeframeScore = 100;
  else if (maxAgreement === 2) multiTimeframeScore = 75;
  else if (maxAgreement === 1 && bullCount + bearCount === 1) multiTimeframeScore = 50;
  else multiTimeframeScore = 25;

  return {
    dailyTrend,
    weeklyTrend,
    monthlyTrend,
    multiTimeframeScore,
  };
}
