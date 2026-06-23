import { HistoricalQuote } from '../types/stock';

export interface MacroDataMap {
  NIFTY: HistoricalQuote[];
  BANKNIFTY: HistoricalQuote[];
  INDIAVIX: HistoricalQuote[];
  USDINR: HistoricalQuote[];
  INTEREST_RATE: HistoricalQuote[];
}

export interface MacroContext {
  niftyTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  niftyStrength: number; // 0-100
  
  bankNiftyTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  bankNiftyStrength: number; // 0-100
  
  vixLevel: number;
  vixTrend: 'RISING' | 'FALLING' | 'FLAT';
  vixPercentile: number; // 0-100
  
  interestRateTrend: 'RISING' | 'FALLING' | 'FLAT';
  interestRateValue: number;
  
  usdInrTrend: 'RISING' | 'FALLING' | 'FLAT';
  usdInrVolatility: number;
  
  macroRiskScore: number; // 0-100
  macroBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

export function evaluateMacroContext(macroData: MacroDataMap, targetDate: string): MacroContext {
  // Default neutral context
  const context: MacroContext = {
    niftyTrend: 'NEUTRAL',
    niftyStrength: 50,
    bankNiftyTrend: 'NEUTRAL',
    bankNiftyStrength: 50,
    vixLevel: 15,
    vixTrend: 'FLAT',
    vixPercentile: 50,
    interestRateTrend: 'FLAT',
    interestRateValue: 6.5,
    usdInrTrend: 'FLAT',
    usdInrVolatility: 50,
    macroRiskScore: 50,
    macroBias: 'NEUTRAL'
  };

  const getRecentBars = (bars: HistoricalQuote[]) => {
    return bars.filter(b => b.date <= targetDate).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // NIFTY
  if (macroData.NIFTY && macroData.NIFTY.length > 0) {
    const bars = getRecentBars(macroData.NIFTY);
    if (bars.length > 200) {
      const closes = bars.map(b => b.close);
      const currentPrice = closes[closes.length - 1];
      const ema50 = calculateEMA(closes, 50);
      const ema200 = calculateEMA(closes, 200);
      const currentEma50 = ema50[ema50.length - 1];
      const currentEma200 = ema200[ema200.length - 1];
      
      const slope50 = currentEma50 > ema50[ema50.length - 5] ? 1 : -1;
      
      if (currentPrice > currentEma200 && slope50 > 0) {
        context.niftyTrend = 'BULLISH';
        context.niftyStrength = 80;
      } else if (currentPrice < currentEma200) {
        context.niftyTrend = 'BEARISH';
        context.niftyStrength = 20;
      }
    }
  }

  // BANKNIFTY
  if (macroData.BANKNIFTY && macroData.BANKNIFTY.length > 0) {
    const bars = getRecentBars(macroData.BANKNIFTY);
    if (bars.length > 200) {
      const closes = bars.map(b => b.close);
      const currentPrice = closes[closes.length - 1];
      const ema200 = calculateEMA(closes, 200);
      const currentEma200 = ema200[ema200.length - 1];
      
      if (currentPrice > currentEma200) {
        context.bankNiftyTrend = 'BULLISH';
        context.bankNiftyStrength = Math.min(100, (currentPrice / currentEma200 - 1) * 500 + 50);
      } else {
        context.bankNiftyTrend = 'BEARISH';
        context.bankNiftyStrength = Math.max(0, 50 - (1 - currentPrice / currentEma200) * 500);
      }
    }
  }

  // INDIA VIX
  if (macroData.INDIAVIX && macroData.INDIAVIX.length > 0) {
    const bars = getRecentBars(macroData.INDIAVIX);
    if (bars.length > 20) {
      const closes = bars.map(b => b.close);
      const currentVix = closes[closes.length - 1];
      context.vixLevel = currentVix;
      
      const vix5 = closes[closes.length - 5];
      if (currentVix > vix5 * 1.1) context.vixTrend = 'RISING';
      else if (currentVix < vix5 * 0.9) context.vixTrend = 'FALLING';
      
      const last252 = closes.slice(-252);
      const lowerCount = last252.filter(v => v < currentVix).length;
      context.vixPercentile = Math.round((lowerCount / last252.length) * 100);
    }
  }

  // INTEREST RATE
  if (macroData.INTEREST_RATE && macroData.INTEREST_RATE.length > 0) {
    const bars = getRecentBars(macroData.INTEREST_RATE);
    if (bars.length > 90) {
      const currentRate = bars[bars.length - 1].close;
      context.interestRateValue = currentRate;
      const rate90 = bars[bars.length - 90].close;
      if (currentRate > rate90) context.interestRateTrend = 'RISING';
      else if (currentRate < rate90) context.interestRateTrend = 'FALLING';
    }
  }

  // USDINR
  if (macroData.USDINR && macroData.USDINR.length > 0) {
    const bars = getRecentBars(macroData.USDINR);
    if (bars.length > 20) {
      const closes = bars.map(b => b.close);
      const currentUsd = closes[closes.length - 1];
      const prevUsd = closes[closes.length - 20];
      if (currentUsd > prevUsd * 1.02) context.usdInrTrend = 'RISING';
      else if (currentUsd < prevUsd * 0.98) context.usdInrTrend = 'FALLING';
      
      // Volatility proxy
      const returns = [];
      for (let i = 1; i < 20; i++) {
        returns.push(Math.abs(closes[closes.length - i] - closes[closes.length - i - 1]));
      }
      const avgVol = returns.reduce((a,b) => a+b, 0) / returns.length;
      context.usdInrVolatility = Math.min(100, avgVol * 1000); // normalized arbitrary
    }
  }

  // MACRO RISK SCORE
  let risk = 50;
  if (context.niftyTrend === 'BEARISH') risk += 15;
  if (context.bankNiftyTrend === 'BEARISH') risk += 10;
  if (context.vixTrend === 'RISING') risk += 10;
  if (context.vixPercentile > 80) risk += 15;
  if (context.interestRateTrend === 'RISING') risk += 10;
  if (context.usdInrTrend === 'RISING') risk += 5; // Weakening rupee
  
  if (context.niftyTrend === 'BULLISH') risk -= 15;
  if (context.vixPercentile < 40) risk -= 10;
  
  context.macroRiskScore = Math.max(0, Math.min(100, Math.round(risk)));

  // MACRO BIAS
  if (context.niftyTrend === 'BULLISH' && context.macroRiskScore < 45) {
    context.macroBias = 'BULLISH';
  } else if (context.niftyTrend === 'BEARISH' || context.macroRiskScore > 70) {
    context.macroBias = 'BEARISH';
  }

  return context;
}

export function applySectorMacroSensitivity(
  sector: string, 
  stockBaseConfidence: number, 
  macro: MacroContext
): { confidence: number, conflict: boolean, reason?: string } {
  const upperSector = sector?.toUpperCase() || 'UNKNOWN';
  let adjustedConfidence = stockBaseConfidence;
  let conflict = false;
  let reason = '';

  if (upperSector.includes('BANK') || upperSector.includes('FINANCE')) {
    if (macro.bankNiftyTrend === 'BEARISH') {
      adjustedConfidence -= 10;
      conflict = true;
      reason = 'Bank NIFTY is bearish';
    } else if (macro.bankNiftyTrend === 'BULLISH') {
      adjustedConfidence += 5;
    }
    if (macro.interestRateTrend === 'RISING') {
      adjustedConfidence -= 5;
    }
  } else if (upperSector.includes('IT') || upperSector.includes('TECH')) {
    if (macro.usdInrTrend === 'RISING') {
      adjustedConfidence += 5; // Exporter benefits
    } else if (macro.usdInrTrend === 'FALLING') {
      adjustedConfidence -= 5;
    }
    if (macro.niftyTrend === 'BEARISH') {
      adjustedConfidence -= 5;
    }
  } else if (upperSector.includes('AUTO') || upperSector.includes('REAL ESTATE')) {
    if (macro.interestRateTrend === 'RISING') {
      adjustedConfidence -= 10;
      conflict = true;
      reason = 'Rising interest rates hurt Auto/Real Estate';
    }
  } else if (upperSector.includes('PHARMA')) {
    if (macro.macroBias === 'BEARISH') {
      adjustedConfidence += 5; // Defensive sector
    }
    if (macro.usdInrTrend === 'RISING') {
      adjustedConfidence += 5; // Exporter
    }
  }

  // General macro overlay
  if (macro.macroBias === 'BEARISH' && stockBaseConfidence > 50) {
    adjustedConfidence -= 5;
    if (!conflict) {
      conflict = true;
      reason = 'Bullish stock setup in a Bearish macro environment';
    }
  }

  return {
    confidence: Math.max(0, Math.min(100, Math.round(adjustedConfidence))),
    conflict,
    reason
  };
}
