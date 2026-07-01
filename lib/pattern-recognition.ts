import { HistoricalQuote, TechnicalIndicators } from '../types/stock';

export function detectMarketPattern(
  history: HistoricalQuote[],
  indicators: TechnicalIndicators,
  currentPrice: number,
  currentVolume: number
) {
  let pattern = "No Clear Pattern";
  let patternBias: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
  let patternStrength = 0;
  let patternConfidence = 0;

  if (!history || history.length < 20) {
    return { pattern, patternBias, patternStrength, patternConfidence };
  }

  // Calculate higher highs, higher lows etc based on last 20 days
  const recent = history.slice(-20);
  const highestHigh = Math.max(...recent.map(d => d.high));
  const lowestLow = Math.min(...recent.map(d => d.low));

  // Divide recent 20 days into two 10-day halves to detect structure
  const firstHalf = recent.slice(0, 10);
  const secondHalf = recent.slice(10, 20);

  const fhHigh = Math.max(...firstHalf.map(d => d.high));
  const fhLow = Math.min(...firstHalf.map(d => d.low));
  const shHigh = Math.max(...secondHalf.map(d => d.high));
  const shLow = Math.min(...secondHalf.map(d => d.low));

  const higherHigh = shHigh > fhHigh;
  const lowerHigh = shHigh < fhHigh;
  const higherLow = shLow > fhLow;
  const lowerLow = shLow < fhLow;
  
  // Flatness thresholds
  const flatResistance = Math.abs(shHigh - fhHigh) / fhHigh < 0.015;
  const flatSupport = Math.abs(shLow - fhLow) / fhLow < 0.015;

  const avgVolumeFirst = firstHalf.reduce((sum, d) => sum + d.volume, 0) / 10;
  const avgVolumeSecond = secondHalf.reduce((sum, d) => sum + d.volume, 0) / 10;
  const volumeContraction = avgVolumeSecond < avgVolumeFirst * 0.85;
  
  const avgVol20 = indicators.avgVolume20 || avgVolumeSecond;
  const volumeExpansion = currentVolume > avgVol20 * 1.5;

  const { sma20, sma50, rsi14: rsi, macd, bollingerUpper, bollingerLower, atr14: atr } = indicators;
  
  // ATR Compression (Squeeze)
  const atrRatio = atr / currentPrice;
  const isSqueeze = atrRatio < 0.015 || (bollingerUpper - bollingerLower < currentPrice * 0.04);

  // --- BULLISH PATTERNS ---
  // 1. Ascending Triangle: Flat resistance, rising lows, volume contraction
  if (flatResistance && higherLow && volumeContraction && currentPrice > sma50) {
    pattern = "Ascending Triangle";
    patternBias = "BULLISH";
    patternStrength = 80;
    patternConfidence = 75;
  }
  // 2. Double Bottom: Two lows within 2%, breaking neckline
  else if (Math.abs(shLow - fhLow) / fhLow < 0.02 && currentPrice > shLow * 1.02 && higherHigh) {
    pattern = "Double Bottom";
    patternBias = "BULLISH";
    patternStrength = 85;
    patternConfidence = 80;
  }
  // 3. Bull Flag: Strong move up, small downward channel, volume contraction
  else if (fhHigh > fhLow * 1.05 && lowerHigh && lowerLow && currentPrice > shLow && volumeContraction) {
    pattern = "Bull Flag";
    patternBias = "BULLISH";
    patternStrength = 75;
    patternConfidence = 70;
  }
  // 4. Moving Average Pullback: Price was above SMA50, pulled back to SMA20, bouncing
  else if (currentPrice > sma50 && Math.abs(currentPrice - sma20) / sma20 < 0.02 && rsi > 45 && rsi < 60 && higherLow) {
    pattern = "Moving Average Pullback";
    patternBias = "BULLISH";
    patternStrength = 70;
    patternConfidence = 75;
  }
  // 5. Support Bounce: Reached shLow, bounced
  else if (currentPrice > shLow && currentPrice < shLow * 1.04 && macd && macd.histogram > 0 && rsi > 40) {
    pattern = "Support Bounce";
    patternBias = "BULLISH";
    patternStrength = 70;
    patternConfidence = 65;
  }
  // 6. Cup and Handle
  else if (fhHigh > fhLow && shLow > fhLow && currentPrice > shHigh * 0.98 && higherLow) {
    pattern = "Cup and Handle";
    patternBias = "BULLISH";
    patternStrength = 85;
    patternConfidence = 75;
  }
  
  // --- BEARISH PATTERNS ---
  // 7. Descending Triangle: Flat support, lower highs, volume contraction
  else if (flatSupport && lowerHigh && volumeContraction && currentPrice < sma50) {
    pattern = "Descending Triangle";
    patternBias = "BEARISH";
    patternStrength = 80;
    patternConfidence = 75;
  }
  // 8. Double Top: Two highs within 2%, breaking down
  else if (Math.abs(shHigh - fhHigh) / fhHigh < 0.02 && currentPrice < shHigh * 0.98 && lowerLow) {
    pattern = "Double Top";
    patternBias = "BEARISH";
    patternStrength = 85;
    patternConfidence = 80;
  }
  // 9. Bear Flag: Strong move down, small upward channel, volume contraction
  else if (fhLow < fhHigh * 0.95 && higherHigh && higherLow && currentPrice < shHigh && volumeContraction) {
    pattern = "Bear Flag";
    patternBias = "BEARISH";
    patternStrength = 75;
    patternConfidence = 70;
  }
  // 10. Resistance Rejection: Reached shHigh, reversed
  else if (currentPrice < shHigh && currentPrice > shHigh * 0.96 && macd && macd.histogram < 0 && rsi < 60) {
    pattern = "Resistance Rejection";
    patternBias = "BEARISH";
    patternStrength = 70;
    patternConfidence = 65;
  }
  // 11. Breakdown From Support
  else if (currentPrice < lowestLow && volumeExpansion) {
    pattern = "Breakdown From Support";
    patternBias = "BEARISH";
    patternStrength = 85;
    patternConfidence = 80;
  }

  // --- MIXED / BREAKOUT ---
  // 12. Volatility Squeeze Breakout: squeeze + volume expansion
  else if (isSqueeze && volumeExpansion) {
    pattern = "Volatility Squeeze Breakout";
    patternBias = currentPrice > sma20 ? "BULLISH" : "BEARISH";
    patternStrength = 90;
    patternConfidence = 85;
  }

  // --- NEUTRAL ---
  // 13. Sideways Consolidation
  else if (Math.abs(highestHigh - lowestLow) / lowestLow < 0.04) {
    pattern = "Sideways Consolidation";
    patternBias = "NEUTRAL";
    patternStrength = 50;
    patternConfidence = 60;
  }
  
  if (pattern !== "No Clear Pattern" && patternBias !== "NEUTRAL") {
     if (volumeExpansion) {
         patternStrength = Math.min(100, patternStrength + 10);
         patternConfidence = Math.min(100, patternConfidence + 10);
     }
  }

  return {
    pattern,
    patternBias,
    patternStrength,
    patternConfidence
  };
}
