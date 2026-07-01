import { HistoricalQuote } from '@/types/stock';

export type RSClassification = 'LEADER' | 'STRONG' | 'AVERAGE' | 'WEAK' | 'LAGGARD';

export interface RelativeStrengthResult {
  score: number;
  classification: RSClassification;
  rs20: number; // Percentage outperformance vs benchmark
  rs50: number;
  rs100: number;
}

/**
 * Calculate the return over N days.
 * Assumes history is sorted oldest to newest.
 */
function calculateReturn(history: HistoricalQuote[], days: number): number {
  if (!history || history.length < 2) return 0;
  
  const currentPrice = history[history.length - 1].close;
  const oldIndex = Math.max(0, history.length - 1 - days);
  const oldPrice = history[oldIndex].close;
  
  if (oldPrice === 0) return 0;
  return (currentPrice - oldPrice) / oldPrice;
}

export function calculateRelativeStrength(
  stockHistory: HistoricalQuote[],
  marketHistory: HistoricalQuote[] | null
): RelativeStrengthResult {
  // Default values if data is insufficient
  if (!stockHistory || !marketHistory || stockHistory.length < 20 || marketHistory.length < 20) {
    return { score: 50, classification: 'AVERAGE', rs20: 0, rs50: 0, rs100: 0 };
  }

  // Ensure histories are sorted oldest to newest
  const sortedStock = [...stockHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const sortedMarket = [...marketHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const stock20 = calculateReturn(sortedStock, 20);
  const stock50 = calculateReturn(sortedStock, 50);
  const stock100 = calculateReturn(sortedStock, 100);

  const market20 = calculateReturn(sortedMarket, 20);
  const market50 = calculateReturn(sortedMarket, 50);
  const market100 = calculateReturn(sortedMarket, 100);

  // Outperformance percentages (e.g., 0.05 = 5%)
  const rs20 = (stock20 - market20) * 100;
  const rs50 = (stock50 - market50) * 100;
  const rs100 = (stock100 - market100) * 100;

  // Weighted outperformance
  const weightedOutperformance = (rs20 * 0.40) + (rs50 * 0.35) + (rs100 * 0.25);

  // Normalize outperformance to a 0-100 score
  // We'll cap outperformance at +/- 25% for the extremes (0 and 100 score).
  // Formula: Score = 50 + (WO / 25) * 50
  let score = 50 + (weightedOutperformance / 25) * 50;
  score = Math.max(0, Math.min(100, Math.round(score)));

  let classification: RSClassification = 'AVERAGE';
  if (score >= 85) classification = 'LEADER';
  else if (score >= 70) classification = 'STRONG';
  else if (score >= 55) classification = 'AVERAGE';
  else if (score >= 40) classification = 'WEAK';
  else classification = 'LAGGARD';

  return {
    score,
    classification,
    rs20: Number(rs20.toFixed(2)),
    rs50: Number(rs50.toFixed(2)),
    rs100: Number(rs100.toFixed(2))
  };
}
