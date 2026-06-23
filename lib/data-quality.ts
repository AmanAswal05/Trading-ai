import { HistoricalQuote } from '@/types/stock';

export interface DataQualityReport {
  score: number; // 0 to 100
  isReliable: boolean;
  warnings: string[];
  reasons: string[];
}

export function validateMarketData(history: HistoricalQuote[], currentPrice: number): DataQualityReport {
  let score = 100;
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (!history || history.length === 0) {
    return { 
      score: 0, 
      isReliable: false, 
      warnings: ['No historical data available'], 
      reasons: ['Empty history array'] 
    };
  }

  // 1. Minimum candle count (need at least 50 for basic indicators, ideally 200)
  if (history.length < 50) {
    score -= 30;
    warnings.push('Low historical data volume');
    reasons.push(`Only ${history.length} days of history available (need at least 50)`);
  } else if (history.length < 100) {
    score -= 10;
    warnings.push('Limited historical data');
    reasons.push(`Only ${history.length} days of history available (ideal is 200+)`);
  }

  // 2. Missing/invalid prices
  if (!currentPrice || currentPrice <= 0 || isNaN(currentPrice)) {
    score -= 50;
    warnings.push('Invalid current price');
    reasons.push(`Current price is ${currentPrice}`);
  }

  let invalidCandles = 0;
  let zeroVolumeCandles = 0;
  let largeJumps = 0;
  let duplicateTimestamps = 0;
  
  const seenDates = new Set<string>();

  for (let i = 0; i < history.length; i++) {
    const quote = history[i];
    
    // Duplicate timestamps
    if (seenDates.has(quote.date)) {
      duplicateTimestamps++;
    }
    seenDates.add(quote.date);

    // Invalid prices
    if (!quote.close || quote.close <= 0 || isNaN(quote.close) || !quote.open || quote.open <= 0 || isNaN(quote.open)) {
      invalidCandles++;
    }

    // Volume missing/zero
    if (quote.volume === 0 || quote.volume === null || quote.volume === undefined || isNaN(quote.volume)) {
      zeroVolumeCandles++;
    }

    // Unrealistic price jumps (> 50%)
    if (i > 0) {
      const prevClose = history[i - 1].close;
      if (prevClose > 0) {
        const change = Math.abs(quote.close - prevClose) / prevClose;
        if (change > 0.5) { // 50% change in one day is highly suspicious, likely an unadjusted split or bad data
          largeJumps++;
        }
      }
    }
  }

  if (invalidCandles > 0) {
    const penalty = Math.min(invalidCandles * 5, 40);
    score -= penalty;
    warnings.push('Contains invalid price data');
    reasons.push(`Found ${invalidCandles} candles with invalid/zero prices`);
  }

  if (duplicateTimestamps > 0) {
    const penalty = Math.min(duplicateTimestamps * 10, 30);
    score -= penalty;
    warnings.push('Duplicate timestamps detected');
    reasons.push(`Found ${duplicateTimestamps} duplicate dates in history`);
  }

  // For some indices or forex, volume is inherently 0, but for stocks it shouldn't be.
  const zeroVolumeRatio = zeroVolumeCandles / history.length;
  if (zeroVolumeRatio > 0.2) {
    const penalty = Math.min(Math.floor(zeroVolumeRatio * 100), 30);
    score -= penalty;
    warnings.push('High amount of missing volume data');
    reasons.push(`${Math.round(zeroVolumeRatio * 100)}% of candles have zero volume`);
  }

  if (largeJumps > 0) {
    const penalty = Math.min(largeJumps * 15, 40);
    score -= penalty;
    warnings.push('Unrealistic price jumps detected');
    reasons.push(`Found ${largeJumps} instances of >50% daily price change (possible unadjusted split)`);
  }

  // Stale latest candle
  const latestQuote = history[history.length - 1];
  const latestDate = new Date(latestQuote.date).getTime();
  const now = new Date().getTime();
  const daysStale = (now - latestDate) / (1000 * 60 * 60 * 24);
  
  if (daysStale > 7) {
    const penalty = Math.min(Math.floor(daysStale) * 2, 40);
    score -= penalty;
    warnings.push('Data is stale');
    reasons.push(`Latest data is ${Math.floor(daysStale)} days old`);
  }

  score = Math.max(0, Math.min(100, score));
  const isReliable = score >= 60;

  return {
    score,
    isReliable,
    warnings,
    reasons
  };
}
