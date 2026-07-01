import {
  RSI,
  MACD,
  BollingerBands,
  SMA,
  EMA,
  ATR,
  Stochastic,
  WilliamsR,
  OBV,
} from 'technicalindicators';
import { HistoricalQuote, TechnicalIndicators } from '../types/stock';

export function calculateIndicators(history: HistoricalQuote[]): TechnicalIndicators {
  // Sort history ascending (oldest first) for technical indicators
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const closes = sortedHistory.map((q) => q.close);
  const highs = sortedHistory.map((q) => q.high);
  const lows = sortedHistory.map((q) => q.low);
  const volumes = sortedHistory.map((q) => q.volume);
  const currentPrice = closes[closes.length - 1] || 0;

  // Helper to extract the last computed value or use a fallback
  const lastVal = <T>(arr: T[], fallback: T): T => {
    return arr && arr.length > 0 ? arr[arr.length - 1] : fallback;
  };

  const len = closes.length;

  // Simple Moving Averages
  const sma20Val = lastVal(
    SMA.calculate({ values: closes, period: Math.min(20, len) }),
    currentPrice
  );
  const sma50Val = lastVal(
    SMA.calculate({ values: closes, period: Math.min(50, len) }),
    currentPrice
  );
  const sma200Val = lastVal(
    SMA.calculate({ values: closes, period: Math.min(200, len) }),
    currentPrice
  );

  // Exponential Moving Averages
  const ema12Val = lastVal(
    EMA.calculate({ values: closes, period: Math.min(12, len) }),
    currentPrice
  );
  const ema20Val = lastVal(
    EMA.calculate({ values: closes, period: Math.min(20, len) }),
    currentPrice
  );
  const ema26Val = lastVal(
    EMA.calculate({ values: closes, period: Math.min(26, len) }),
    currentPrice
  );
  const ema50Val = lastVal(
    EMA.calculate({ values: closes, period: Math.min(50, len) }),
    currentPrice
  );

  // Relative Strength Index (RSI)
  const rsiVal = lastVal(
    RSI.calculate({ values: closes, period: Math.min(14, len) }),
    50
  );

  // Moving Average Convergence Divergence (MACD)
  const macdResults = len >= 26
    ? MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      })
    : [];
  const macdVal = lastVal(macdResults, { MACD: 0, signal: 0, histogram: 0 });

  // Bollinger Bands
  const bbResults = len >= 20
    ? BollingerBands.calculate({
        values: closes,
        period: Math.min(20, len),
        stdDev: 2,
      })
    : [];
  const bbVal = lastVal(bbResults, {
    upper: currentPrice * 1.05,
    middle: currentPrice,
    lower: currentPrice * 0.95,
    pb: 0.5,
  });

  // Average True Range (ATR)
  const atrVal = lastVal(
    ATR.calculate({ high: highs, low: lows, close: closes, period: Math.min(14, len) }),
    currentPrice * 0.02 || 1
  );

  // Stochastic Oscillator
  const stochResults = len >= 14
    ? Stochastic.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: Math.min(14, len),
        signalPeriod: 3,
      })
    : [];
  const stochVal = lastVal(stochResults, { k: 50, d: 50 });

  // Williams %R
  const willRResults = len >= 14
    ? WilliamsR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: Math.min(14, len),
      })
    : [];
  const williamsVal = lastVal(willRResults, -50);

  // On-Balance Volume (OBV)
  const obvResults = OBV.calculate({
    close: closes,
    volume: volumes,
  });
  const obvVal = lastVal(obvResults, 0);

  return {
    rsi14: Number(rsiVal.toFixed(2)),
    macd: {
      macd: Number((macdVal.MACD || 0).toFixed(2)),
      signal: Number((macdVal.signal || 0).toFixed(2)),
      histogram: Number((macdVal.histogram || 0).toFixed(2)),
    },
    sma20: Number(sma20Val.toFixed(2)),
    sma50: Number(sma50Val.toFixed(2)),
    sma200: Number(sma200Val.toFixed(2)),
    ema12: Number(ema12Val.toFixed(2)),
    ema20: Number(ema20Val.toFixed(2)),
    ema26: Number(ema26Val.toFixed(2)),
    ema50: Number(ema50Val.toFixed(2)),
    bollingerUpper: Number((bbVal.upper || currentPrice).toFixed(2)),
    bollingerMiddle: Number((bbVal.middle || currentPrice).toFixed(2)),
    bollingerLower: Number((bbVal.lower || currentPrice).toFixed(2)),
    atr14: Number(atrVal.toFixed(2)),
    stochasticK: Number((stochVal.k || 50).toFixed(2)),
    stochasticD: Number((stochVal.d || 50).toFixed(2)),
    williamsR: Number(williamsVal.toFixed(2)),
    obv: Math.round(obvVal),
  };
}

export function precomputeAllIndicators(history: HistoricalQuote[]): TechnicalIndicators[] {
  // Sort history ascending (oldest first) for technical indicators
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const closes = sortedHistory.map((q) => q.close);
  const highs = sortedHistory.map((q) => q.high);
  const lows = sortedHistory.map((q) => q.low);
  const volumes = sortedHistory.map((q) => q.volume);
  const L = sortedHistory.length;

  const len = L;

  // Precompute arrays using technicalindicators on full history
  const sma20Arr = SMA.calculate({ values: closes, period: Math.min(20, len) }) || [];
  const sma50Arr = SMA.calculate({ values: closes, period: Math.min(50, len) }) || [];
  const sma200Arr = SMA.calculate({ values: closes, period: Math.min(200, len) }) || [];

  const ema12Arr = EMA.calculate({ values: closes, period: Math.min(12, len) }) || [];
  const ema20Arr = EMA.calculate({ values: closes, period: Math.min(20, len) }) || [];
  const ema26Arr = EMA.calculate({ values: closes, period: Math.min(26, len) }) || [];
  const ema50Arr = EMA.calculate({ values: closes, period: Math.min(50, len) }) || [];

  const rsi14Arr = RSI.calculate({ values: closes, period: Math.min(14, len) }) || [];

  const macdArr = len >= 26
    ? MACD.calculate({
        values: closes,
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      })
    : [];

  const bbArr = len >= 20
    ? BollingerBands.calculate({
        values: closes,
        period: Math.min(20, len),
        stdDev: 2,
      })
    : [];

  const atr14Arr = ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: Math.min(14, len),
  }) || [];

  const stochArr = len >= 14
    ? Stochastic.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: Math.min(14, len),
        signalPeriod: 3,
      })
    : [];

  const williamsRArr = WilliamsR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: Math.min(14, len),
  }) || [];

  const obvArr = OBV.calculate({ close: closes, volume: volumes }) || [];

  // Precompute 20-day average volume for each index
  const avgVolumes: number[] = [];
  for (let i = 0; i < L; i++) {
    const start = Math.max(0, i - 19);
    const slice = volumes.slice(start, i + 1);
    const avg = slice.reduce((sum, v) => sum + (v || 0), 0) / (slice.length || 1);
    avgVolumes.push(avg);
  }

  // Helper to extract value at index `i` of input history
  const getValAt = <T>(arr: T[], i: number, fallback: T): T => {
    const arrLen = arr.length;
    const k = i - (L - arrLen);
    return k >= 0 && k < arrLen ? arr[k] : fallback;
  };

  const results: TechnicalIndicators[] = [];

  for (let i = 0; i < L; i++) {
    const currentPrice = closes[i];

    const sma20Val = getValAt(sma20Arr, i, currentPrice);
    const sma50Val = getValAt(sma50Arr, i, currentPrice);
    const sma200Val = getValAt(sma200Arr, i, currentPrice);

    const ema12Val = getValAt(ema12Arr, i, currentPrice);
    const ema20Val = getValAt(ema20Arr, i, currentPrice);
    const ema26Val = getValAt(ema26Arr, i, currentPrice);
    const ema50Val = getValAt(ema50Arr, i, currentPrice);

    const rsiVal = getValAt(rsi14Arr, i, 50);

    const macdVal = getValAt(macdArr, i, { MACD: 0, signal: 0, histogram: 0 });

    const bbVal = getValAt(bbArr, i, {
      upper: currentPrice * 1.05,
      middle: currentPrice,
      lower: currentPrice * 0.95,
      pb: 0.5,
    });

    const atrVal = getValAt(atr14Arr, i, currentPrice * 0.02 || 1);

    const stochVal = getValAt(stochArr, i, { k: 50, d: 50 });

    const williamsVal = getValAt(williamsRArr, i, -50);

    const obvVal = getValAt(obvArr, i, 0);

    results.push({
      rsi14: Number(rsiVal.toFixed(2)),
      macd: {
        macd: Number((macdVal.MACD || 0).toFixed(2)),
        signal: Number((macdVal.signal || 0).toFixed(2)),
        histogram: Number((macdVal.histogram || 0).toFixed(2)),
      },
      sma20: Number(sma20Val.toFixed(2)),
      sma50: Number(sma50Val.toFixed(2)),
      sma200: Number(sma200Val.toFixed(2)),
      ema12: Number(ema12Val.toFixed(2)),
      ema20: Number(ema20Val.toFixed(2)),
      ema26: Number(ema26Val.toFixed(2)),
      ema50: Number(ema50Val.toFixed(2)),
      bollingerUpper: Number((bbVal.upper || currentPrice).toFixed(2)),
      bollingerMiddle: Number((bbVal.middle || currentPrice).toFixed(2)),
      bollingerLower: Number((bbVal.lower || currentPrice).toFixed(2)),
      atr14: Number(atrVal.toFixed(2)),
      stochasticK: Number((stochVal.k || 50).toFixed(2)),
      stochasticD: Number((stochVal.d || 50).toFixed(2)),
      williamsR: Number(williamsVal.toFixed(2)),
      obv: Math.round(obvVal),
      avgVolume20: Number(avgVolumes[i].toFixed(2)),
    });
  }

  return results;
}
