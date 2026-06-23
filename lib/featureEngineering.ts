/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { HistoricalQuote, TechnicalIndicators } from '../types/stock';
import { SMA, EMA, ATR } from 'technicalindicators';

export interface SmartFeatures {
  // Trend Features
  trendStrength: number;
  trendDuration: number;
  emaDistance20: number;
  emaDistance50: number;
  emaDistance200: number;
  emaSlope20: number;
  emaSlope50: number;
  emaSlope200: number;

  // Volatility Features
  atrExpansion: number;
  atrCompressionPercentile: number;
  rollingVolatility20: number;
  rollingVolatility50: number;
  volatilityPercentile100: number;

  // Volume Features
  relativeVolume: number;
  volumeAcceleration: number;
  volumeConfirmationScore: number;

  // Market Features
  indexStrength: number;
  sectorStrength: number;
  relativePerformance5: number;
  relativePerformance20: number;
  relativePerformance60: number;

  // Multi-Timeframe Features
  higherTimeframeTrend: number; // 1 (Bull), -1 (Bear), 0 (Neutral)
  higherTimeframeStrength: number;
  alignmentScore: number;
  timeframeConflict: number; // 1 (Conflict), 0 (No Conflict)

  // Macro Features (Priority 10)
  macroNiftyStrength: number;
  macroBankNiftyStrength: number;
  macroVixLevel: number;
  macroVixPercentile: number;
  macroInterestRateTrend: number; // 1 (Rising), -1 (Falling), 0 (Flat)
  macroUsdInrTrend: number;       // 1 (Rising), -1 (Falling), 0 (Flat)
  macroRiskScore: number;
}

export interface ScalerMetadata {
  means: Record<string, number>;
  stds: Record<string, number>;
}

import { resampleBars, analyzeTimeframe, calculateAlignment } from './multiTimeframeAnalysis';
import { MacroContext } from './macroContext';

export function extractFeatures(
  bars: HistoricalQuote[],
  currentIndex: number,
  indexBars?: HistoricalQuote[],
  sectorBars?: HistoricalQuote[],
  macroContext?: MacroContext
): SmartFeatures {
  const slice = bars.slice(0, currentIndex + 1);
  if (slice.length < 200) {
    throw new Error('Not enough historical bars to extract features (requires at least 200)');
  }

  const closes = slice.map(b => b.close);
  const highs = slice.map(b => b.high);
  const lows = slice.map(b => b.low);
  const volumes = slice.map(b => b.volume);
  const currentPrice = closes[closes.length - 1];

  // Moving Averages
  const ema20Arr = EMA.calculate({ values: closes, period: 20 });
  const ema50Arr = EMA.calculate({ values: closes, period: 50 });
  const ema200Arr = EMA.calculate({ values: closes, period: 200 });

  const ema20 = ema20Arr.length > 0 ? ema20Arr[ema20Arr.length - 1] : currentPrice;
  const ema50 = ema50Arr.length > 0 ? ema50Arr[ema50Arr.length - 1] : currentPrice;
  const ema200 = ema200Arr.length > 0 ? ema200Arr[ema200Arr.length - 1] : currentPrice;

  // EMA Distances
  const emaDistance20 = (currentPrice - ema20) / ema20;
  const emaDistance50 = (currentPrice - ema50) / ema50;
  const emaDistance200 = (currentPrice - ema200) / ema200;

  // EMA Slopes (Normalized by EMA)
  const safeGet = (arr: number[], offset: number, fallback: number) => 
    arr.length > offset ? arr[arr.length - 1 - offset] : fallback;

  const emaSlope20 = (ema20 - safeGet(ema20Arr, 5, ema20)) / safeGet(ema20Arr, 5, ema20);
  const emaSlope50 = (ema50 - safeGet(ema50Arr, 10, ema50)) / safeGet(ema50Arr, 10, ema50);
  const emaSlope200 = (ema200 - safeGet(ema200Arr, 20, ema200)) / safeGet(ema200Arr, 20, ema200);

  // Trend Strength (0 to 1) based on EMA alignment and slopes
  let trendStrength = 0;
  if (ema20 > ema50 && ema50 > ema200) trendStrength += 0.4;
  else if (ema20 < ema50 && ema50 < ema200) trendStrength += 0.4; // Strong bearish is still a strong trend
  if (Math.abs(emaSlope20) > 0.01) trendStrength += 0.2;
  if (Math.abs(emaDistance200) > 0.1) trendStrength += 0.2;
  
  // Highs and Lows analysis for trend strength
  const last10Closes = closes.slice(-10);
  let higherHighs = 0, lowerLows = 0;
  for (let i = 1; i < last10Closes.length; i++) {
    if (last10Closes[i] > last10Closes[i-1]) higherHighs++;
    if (last10Closes[i] < last10Closes[i-1]) lowerLows++;
  }
  if (higherHighs >= 7 || lowerLows >= 7) trendStrength += 0.2;
  trendStrength = Math.min(1, Math.max(0, trendStrength));

  // Trend Duration
  let trendDuration = 0;
  const isBullish = ema20 > ema50;
  for (let i = 0; i < Math.min(ema20Arr.length, ema50Arr.length); i++) {
    const e20 = ema20Arr[ema20Arr.length - 1 - i];
    const e50 = ema50Arr[ema50Arr.length - 1 - i];
    if ((e20 > e50) === isBullish) {
      trendDuration++;
    } else {
      break;
    }
  }

  // ATR & Volatility
  const atrArr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const currentATR = atrArr.length > 0 ? atrArr[atrArr.length - 1] : (currentPrice * 0.02);
  const atrSma50Arr = SMA.calculate({ values: atrArr, period: 50 });
  const avgATR50 = atrSma50Arr.length > 0 ? atrSma50Arr[atrSma50Arr.length - 1] : currentATR;
  
  const atrExpansion = avgATR50 > 0 ? currentATR / avgATR50 : 1;

  // ATR Compression Percentile
  const last100ATRs = atrArr.slice(-100);
  const atrCompressionPercentile = last100ATRs.length > 0 
    ? last100ATRs.filter(v => v < currentATR).length / last100ATRs.length 
    : 0.5;

  // Rolling Volatility (using log returns)
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }
  
  const calcVol = (period: number) => {
    if (logReturns.length < period) return 0;
    const slice = logReturns.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    return Math.sqrt(variance);
  };

  const rollingVolatility20 = calcVol(20);
  const rollingVolatility50 = calcVol(50);
  
  const last100Vols = [];
  for (let i = 0; i < 100; i++) {
    if (logReturns.length - i >= 20) {
      const slice = logReturns.slice(logReturns.length - 20 - i, logReturns.length - i);
      const mean = slice.reduce((a, b) => a + b, 0) / 20;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 20;
      last100Vols.push(Math.sqrt(variance));
    }
  }
  const volatilityPercentile100 = last100Vols.length > 0
    ? last100Vols.filter(v => v < rollingVolatility20).length / last100Vols.length
    : 0.5;

  // Volume Features
  const last20Vols = volumes.slice(-20);
  const avgVol20 = last20Vols.reduce((a, b) => a + b, 0) / last20Vols.length;
  const relativeVolume = avgVol20 > 0 ? volumes[volumes.length - 1] / avgVol20 : 1;

  const last5Vols = volumes.slice(-5);
  const avgVol5 = last5Vols.reduce((a, b) => a + b, 0) / last5Vols.length;
  const volumeAcceleration = avgVol20 > 0 ? avgVol5 / avgVol20 : 1;

  let volumeConfirmationScore = 0;
  const priceUp = closes[closes.length - 1] > closes[closes.length - 2];
  if (priceUp && relativeVolume > 1) volumeConfirmationScore = 1; // bullish confirmation
  else if (!priceUp && relativeVolume > 1) volumeConfirmationScore = -1; // bearish confirmation
  else volumeConfirmationScore = 0; // low confidence

  // Market Features (using indexBars if provided, else fallback to 0/neutral)
  let indexStrength = 0;
  let relativePerformance5 = 0;
  let relativePerformance20 = 0;
  let relativePerformance60 = 0;

  if (indexBars && indexBars.length > 0) {
    const idxCloses = indexBars.slice(0, currentIndex + 1).map(b => b.close);
    if (idxCloses.length >= 200) {
      const idxEma50Arr = EMA.calculate({ values: idxCloses, period: 50 });
      const idxEma200Arr = EMA.calculate({ values: idxCloses, period: 200 });
      const idxCurrent = idxCloses[idxCloses.length - 1];
      const idxEma50 = idxEma50Arr[idxEma50Arr.length - 1];
      const idxEma200 = idxEma200Arr[idxEma200Arr.length - 1];

      if (idxCurrent > idxEma50) indexStrength += 0.5;
      if (idxCurrent > idxEma200) indexStrength += 0.5;

      const calcRelPerf = (period: number) => {
        if (closes.length < period || idxCloses.length < period) return 0;
        const stockRet = (closes[closes.length - 1] - closes[closes.length - period]) / closes[closes.length - period];
        const idxRet = (idxCloses[idxCloses.length - 1] - idxCloses[idxCloses.length - period]) / idxCloses[idxCloses.length - period];
        return stockRet - idxRet;
      };

      relativePerformance5 = calcRelPerf(5);
      relativePerformance20 = calcRelPerf(20);
      relativePerformance60 = calcRelPerf(60);
    }
  }

  // Sector Features (fallback to neutral if none)
  const sectorStrength = 0;

  // Multi-Timeframe Analysis
  const primaryAnalysis = analyzeTimeframe(slice, false);
  const lowerAnalysis = analyzeTimeframe(slice, true); // proxy for momentum
  const weeklyBars = resampleBars(slice, 'W');
  const higherAnalysis = analyzeTimeframe(weeklyBars, false);

  const mtfResult = calculateAlignment(higherAnalysis, primaryAnalysis, lowerAnalysis);
  
  const mapTrend = (t: string) => t === 'BULLISH' ? 1 : t === 'BEARISH' ? -1 : 0;
  const higherTimeframeTrend = mapTrend(mtfResult.higherTimeframeTrend);
  const alignmentScore = mtfResult.alignmentScore;
  const timeframeConflict = mtfResult.alignmentScore < 40 ? 1 : 0;

  // Priority 10: Extract Macro Features
  const macroNiftyStrength = macroContext ? macroContext.niftyStrength : 50;
  const macroBankNiftyStrength = macroContext ? macroContext.bankNiftyStrength : 50;
  const macroVixLevel = macroContext ? macroContext.vixLevel : 15;
  const macroVixPercentile = macroContext ? macroContext.vixPercentile : 50;
  const macroInterestRateTrend = macroContext ? (macroContext.interestRateTrend === 'RISING' ? 1 : macroContext.interestRateTrend === 'FALLING' ? -1 : 0) : 0;
  const macroUsdInrTrend = macroContext ? (macroContext.usdInrTrend === 'RISING' ? 1 : macroContext.usdInrTrend === 'FALLING' ? -1 : 0) : 0;
  const macroRiskScore = macroContext ? macroContext.macroRiskScore : 50;

  return {
    trendStrength,
    trendDuration,
    emaDistance20,
    emaDistance50,
    emaDistance200,
    emaSlope20,
    emaSlope50,
    emaSlope200,
    atrExpansion,
    atrCompressionPercentile,
    rollingVolatility20,
    rollingVolatility50,
    volatilityPercentile100,
    relativeVolume,
    volumeAcceleration,
    volumeConfirmationScore,
    indexStrength,
    sectorStrength,
    relativePerformance5,
    relativePerformance20,
    relativePerformance60,
    higherTimeframeTrend,
    higherTimeframeStrength: higherAnalysis.trendStrength,
    alignmentScore,
    timeframeConflict,
    macroNiftyStrength,
    macroBankNiftyStrength,
    macroVixLevel,
    macroVixPercentile,
    macroInterestRateTrend,
    macroUsdInrTrend,
    macroRiskScore
  };
}

/**
 * Fits a robust scaler using training records to prevent leakage.
 * Uses Z-score standardization (0 mean, 1 std dev).
 */
export function fitScaler(trainFeatures: SmartFeatures[]): ScalerMetadata {
  if (trainFeatures.length === 0) {
    return { means: {}, stds: {} };
  }

  const keys = Object.keys(trainFeatures[0]) as (keyof SmartFeatures)[];
  const means: Record<string, number> = {};
  const stds: Record<string, number> = {};

  for (const key of keys) {
    const values = trainFeatures.map(f => f[key] as number);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    means[key] = mean;
    stds[key] = Math.sqrt(variance);
  }

  return { means, stds };
}

/**
 * Applies the fitted scaler to raw features safely.
 */
export function transformFeatures(features: SmartFeatures, scaler: ScalerMetadata): SmartFeatures {
  const scaled = { ...features };
  const keys = Object.keys(features) as (keyof SmartFeatures)[];

  for (const key of keys) {
    const mean = scaler.means[key] ?? 0;
    const std = scaler.stds[key] ?? 1;
    const safeStd = std === 0 ? 1 : std; // Prevent div by zero
    (scaled as any)[key] = ((features[key] as number) - mean) / safeStd;
  }

  return scaled;
}
