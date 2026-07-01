import { HistoricalQuote } from '@/types/stock';

export interface SupportResistanceLevels {
  nearestSupport: number | null;
  nearestResistance: number | null;
  supportLevels: number[];
  resistanceLevels: number[];
  breakoutLevel: number | null;
}

export function calculateSupportResistanceLevels(
  history: HistoricalQuote[],
  currentPrice: number,
  isBullish: boolean
): SupportResistanceLevels {
  const candles = history.slice(-120);
  if (candles.length < 5) {
    return {
      nearestSupport: null,
      nearestResistance: null,
      supportLevels: [],
      resistanceLevels: [],
      breakoutLevel: null
    };
  }

  const rawSupport: number[] = [];
  const rawResistance: number[] = [];

  // Detect swing lows and highs
  for (let i = 2; i < candles.length - 2; i++) {
    const prev2 = candles[i - 2];
    const prev1 = candles[i - 1];
    const curr = candles[i];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];

    // Swing Low
    if (
      curr.low < prev2.low &&
      curr.low < prev1.low &&
      curr.low <= next1.low &&
      curr.low <= next2.low
    ) {
      rawSupport.push(curr.low);
    }

    // Swing High
    if (
      curr.high > prev2.high &&
      curr.high > prev1.high &&
      curr.high >= next1.high &&
      curr.high >= next2.high
    ) {
      rawResistance.push(curr.high);
    }
  }

  // Cluster nearby levels (within 1%)
  const clusterLevels = (levels: number[]) => {
    if (levels.length === 0) return [];
    
    // Sort descending for processing
    const sorted = [...levels].sort((a, b) => b - a);
    const clustered: number[] = [];
    
    let currentCluster = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const avg = currentCluster.reduce((sum, val) => sum + val, 0) / currentCluster.length;
      if (Math.abs(sorted[i] - avg) / avg <= 0.01) {
        currentCluster.push(sorted[i]);
      } else {
        clustered.push(currentCluster.reduce((sum, val) => sum + val, 0) / currentCluster.length);
        currentCluster = [sorted[i]];
      }
    }
    if (currentCluster.length > 0) {
      clustered.push(currentCluster.reduce((sum, val) => sum + val, 0) / currentCluster.length);
    }
    
    return clustered;
  };

  const supportLevels = clusterLevels(rawSupport).sort((a, b) => b - a); // Descending
  const resistanceLevels = clusterLevels(rawResistance).sort((a, b) => a - b); // Ascending

  // Find nearest support (below current price)
  const supportsBelow = supportLevels.filter(lvl => lvl < currentPrice);
  const nearestSupport = supportsBelow.length > 0 ? supportsBelow[0] : null; // Already sorted descending

  // Find nearest resistance (above current price)
  const resistancesAbove = resistanceLevels.filter(lvl => lvl > currentPrice);
  const nearestResistance = resistancesAbove.length > 0 ? resistancesAbove[0] : null; // Already sorted ascending

  const breakoutLevel = isBullish ? nearestResistance : nearestSupport;

  return {
    nearestSupport,
    nearestResistance,
    supportLevels,
    resistanceLevels,
    breakoutLevel
  };
}
