import { HistoricalQuote } from '@/types/stock';
import { precomputeAllIndicators } from './indicators';
import { SectorType, RegionType } from './sector-map';

export type SectorClassification = 'VERY_STRONG' | 'STRONG' | 'NEUTRAL' | 'WEAK' | 'VERY_WEAK';

export interface SectorStrength {
  sector: SectorType;
  region: RegionType;
  score: number;
  classification: SectorClassification;
  isFallback: boolean;
}

export function calculateSectorStrength(
  sector: SectorType,
  region: RegionType,
  history: HistoricalQuote[],
  marketHistory: HistoricalQuote[] | null
): SectorStrength {
  
  if (!history || history.length < 50) {
    return {
      sector,
      region,
      score: 50,
      classification: 'NEUTRAL',
      isFallback: true
    };
  }

  // Ensure history is sorted oldest to newest
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Need indicators to calculate EMA and RSI
  const indicatorsArr = precomputeAllIndicators(sorted);
  const currentInd = indicatorsArr[indicatorsArr.length - 1];
  const oldInd = indicatorsArr.length > 10 ? indicatorsArr[indicatorsArr.length - 11] : currentInd;

  const currentPrice = sorted[sorted.length - 1].close;
  const oldPrice20 = sorted.length > 20 ? sorted[sorted.length - 21].close : currentPrice;

  // Components
  // 1. 20 EMA > 50 EMA (30%)
  const ema20 = currentInd.ema20 || currentInd.sma20;
  const ema50 = currentInd.ema50 || currentInd.sma50;
  
  let emaCrossScore = 0;
  if (ema20 && ema50) {
    if (ema20 > ema50 * 1.02) emaCrossScore = 30; // Strongly above
    else if (ema20 > ema50) emaCrossScore = 20; // Above
    else if (ema20 > ema50 * 0.98) emaCrossScore = 10; // Slightly below
    else emaCrossScore = 0;
  } else {
    emaCrossScore = 15; // Neutral
  }

  // 2. 50 EMA Slope (25%)
  let emaSlopeScore = 0;
  const oldEma50 = oldInd ? (oldInd.ema50 || oldInd.sma50) : ema50;
  if (ema50 && oldEma50) {
    const slope = (ema50 - oldEma50) / oldEma50;
    if (slope > 0.02) emaSlopeScore = 25;
    else if (slope > 0.005) emaSlopeScore = 20;
    else if (slope > -0.005) emaSlopeScore = 12;
    else if (slope > -0.02) emaSlopeScore = 5;
    else emaSlopeScore = 0;
  } else {
    emaSlopeScore = 12; // Neutral
  }

  // 3. RSI position (20%)
  const rsi = currentInd.rsi14 || 50;
  let rsiScore = 0;
  if (rsi >= 60 && rsi <= 80) rsiScore = 20; // Bullish zone
  else if (rsi > 45 && rsi < 60) rsiScore = 12; // Neutral/mild bullish
  else if (rsi > 80) rsiScore = 5; // Overbought (too extended)
  else if (rsi >= 35 && rsi <= 45) rsiScore = 5; // Mild bearish
  else rsiScore = 0; // Oversold / Bearish

  // 4. Momentum over 20 sessions (10%)
  let momentumScore = 0;
  const momentum = (currentPrice - oldPrice20) / oldPrice20;
  if (momentum > 0.05) momentumScore = 10;
  else if (momentum > 0.02) momentumScore = 8;
  else if (momentum > 0) momentumScore = 5;
  else if (momentum > -0.03) momentumScore = 2;
  else momentumScore = 0;

  // 5. Relative Strength vs Market (15%)
  let rsScore = 7; // Neutral default
  if (marketHistory && marketHistory.length >= 20) {
    const marketSorted = [...marketHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const marketCurrent = marketSorted[marketSorted.length - 1].close;
    const marketOld20 = marketSorted[marketSorted.length - 21]?.close || marketCurrent;
    
    const marketMomentum = (marketCurrent - marketOld20) / marketOld20;
    const alpha = momentum - marketMomentum; // Sector outperformance
    
    if (alpha > 0.04) rsScore = 15; // Strongly outperforming
    else if (alpha > 0.01) rsScore = 12; // Outperforming
    else if (alpha > -0.01) rsScore = 7; // Matching market
    else if (alpha > -0.04) rsScore = 3; // Underperforming
    else rsScore = 0; // Strongly underperforming
  }

  // Total Score (0-100)
  const totalScore = Math.min(100, Math.max(0, emaCrossScore + emaSlopeScore + rsiScore + momentumScore + rsScore));

  // Classification
  let classification: SectorClassification = 'NEUTRAL';
  if (totalScore >= 80) classification = 'VERY_STRONG';
  else if (totalScore >= 60) classification = 'STRONG';
  else if (totalScore >= 40) classification = 'NEUTRAL';
  else if (totalScore >= 20) classification = 'WEAK';
  else classification = 'VERY_WEAK';

  return {
    sector,
    region,
    score: Math.round(totalScore),
    classification,
    isFallback: false
  };
}
