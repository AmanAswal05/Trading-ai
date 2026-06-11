// ─── Historical OHLCV Data Fetcher (Yahoo Finance) ────────────────────────────

import { OHLCVBar } from './types';

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const BATCH_DELAY_MS = 250; // rate limit courtesy delay between tickers

// ─── Fetch Single Ticker ───────────────────────────────────────────────────────

/**
 * Fetches daily OHLCV bars from Yahoo Finance for a given ticker and date range.
 * Uses adjusted close prices for accuracy in long-horizon backtesting.
 */
export async function fetchHistoricalOHLCV(
  ticker: string,
  startDate: string, // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
): Promise<OHLCVBar[]> {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate).getTime() / 1000);

  const url = `${YAHOO_BASE}/${encodeURIComponent(ticker)}?period1=${startTs}&period2=${endTs}&interval=1d&events=history&includeAdjustedClose=true`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        if (res.status === 429) {
          // Rate limited — wait longer
          await sleep(RETRY_DELAY_MS * attempt * 2);
          continue;
        }
        if (res.status === 404) {
          console.warn(`[DataFetcher] Ticker ${ticker} not found on Yahoo Finance`);
          return [];
        }
        throw new Error(`Yahoo Finance returned ${res.status} for ${ticker}`);
      }

      const json = await res.json();
      return parseYahooResponse(json, ticker);
    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        console.error(`[DataFetcher] Failed to fetch ${ticker} after ${MAX_RETRIES} attempts:`, err.message);
        return [];
      }
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  return [];
}

// ─── Parse Yahoo Finance Response ─────────────────────────────────────────────

function parseYahooResponse(json: any, ticker: string): OHLCVBar[] {
  try {
    const result = json?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp ?? [];
    const quotes = result.indicators?.quote?.[0] ?? {};
    const adjClose: number[] = result.indicators?.adjclose?.[0]?.adjclose ?? [];

    const opens: number[] = quotes.open ?? [];
    const highs: number[] = quotes.high ?? [];
    const lows: number[] = quotes.low ?? [];
    const closes: number[] = quotes.close ?? [];
    const volumes: number[] = quotes.volume ?? [];

    const bars: OHLCVBar[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      // Skip bars with null/missing data (common in Yahoo Finance)
      if (
        opens[i] == null || highs[i] == null ||
        lows[i] == null || closes[i] == null
      ) continue;

      const date = new Date(timestamps[i] * 1000);
      bars.push({
        date: date.toISOString().split('T')[0],
        open: round(opens[i]),
        high: round(highs[i]),
        low: round(lows[i]),
        close: round(closes[i]),
        volume: Math.round(volumes[i] ?? 0),
        adjClose: adjClose[i] != null ? round(adjClose[i]) : round(closes[i]),
      });
    }

    return bars;
  } catch (err) {
    console.error(`[DataFetcher] Parse error for ${ticker}:`, err);
    return [];
  }
}

// ─── Batch Fetcher with Rate Limiting ─────────────────────────────────────────

export interface BatchFetchProgress {
  completed: number;
  total: number;
  currentTicker: string;
  failed: string[];
}

/**
 * Fetches OHLCV data for multiple tickers with rate limiting.
 * Calls onProgress callback after each ticker completes.
 */
export async function fetchBatchOHLCV(
  tickers: string[],
  startDate: string,
  endDate: string,
  onProgress?: (progress: BatchFetchProgress) => void
): Promise<Map<string, OHLCVBar[]>> {
  const results = new Map<string, OHLCVBar[]>();
  const failed: string[] = [];

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    try {
      const bars = await fetchHistoricalOHLCV(ticker, startDate, endDate);
      results.set(ticker, bars);

      if (onProgress) {
        onProgress({
          completed: i + 1,
          total: tickers.length,
          currentTicker: ticker,
          failed: [...failed],
        });
      }
    } catch (err) {
      console.error(`[DataFetcher] Failed batch fetch for ${ticker}:`, err);
      failed.push(ticker);
      results.set(ticker, []);
    }

    // Courtesy delay to avoid rate limiting (skip on last item)
    if (i < tickers.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return results;
}

// ─── Compute Technical Indicators from OHLCV ──────────────────────────────────

/**
 * Computes a full set of technical indicators for a given bar index
 * using the history array. Returns null if insufficient data.
 */
export function computeIndicatorsFromHistory(
  history: OHLCVBar[],
  index: number
): Record<string, any> | null {
  if (index < 200) return null; // Need at least 200 bars for SMA200

  const slice = history.slice(0, index + 1);
  const closes = slice.map(b => b.adjClose ?? b.close);
  const volumes = slice.map(b => b.volume);
  const highs = slice.map(b => b.high);
  const lows = slice.map(b => b.low);
  const price = closes[closes.length - 1];

  // SMAs
  const sma20 = mean(closes.slice(-20));
  const sma50 = mean(closes.slice(-50));
  const sma200 = mean(closes.slice(-200));

  // EMAs
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);

  // MACD
  const macdLine = ema12 - ema26;
  const macdSignal = computeEMA(closes.slice(-35).map((_, i, arr) => {
    const e12 = computeEMA(arr.slice(0, i + 1), 12);
    const e26 = computeEMA(arr.slice(0, i + 1), 26);
    return e12 - e26;
  }), 9);
  const macdHistogram = macdLine - macdSignal;

  // RSI 14
  const rsi14 = computeRSI(closes, 14);

  // Bollinger Bands (20, 2)
  const bb20Mean = sma20;
  const bb20Std = stdDev(closes.slice(-20));
  const bollingerUpper = bb20Mean + 2 * bb20Std;
  const bollingerMiddle = bb20Mean;
  const bollingerLower = bb20Mean - 2 * bb20Std;

  // ATR 14
  const atr14 = computeATR(highs, lows, closes, 14);

  // Stochastic (14, 3)
  const { k: stochasticK, d: stochasticD } = computeStochastic(highs, lows, closes, 14, 3);

  // Williams %R (14)
  const williamsR = computeWilliamsR(highs, lows, closes, 14);

  // OBV
  const obv = computeOBV(closes, volumes);

  // Avg Volume 20
  const avgVolume20 = mean(volumes.slice(-20));

  return {
    rsi14,
    macd: { macd: macdLine, signal: macdSignal, histogram: macdHistogram },
    sma20,
    sma50,
    sma200,
    ema12,
    ema26,
    bollingerUpper,
    bollingerMiddle,
    bollingerLower,
    atr14,
    stochasticK,
    stochasticD,
    williamsR,
    obv,
    avgVolume20,
  };
}

// ─── Technical Indicator Implementations ──────────────────────────────────────

function computeEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const recentChanges = changes.slice(-period);
  const gains = recentChanges.map(c => (c > 0 ? c : 0));
  const losses = recentChanges.map(c => (c < 0 ? -c : 0));
  const avgGain = mean(gains);
  const avgLoss = mean(losses);
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeATR(highs: number[], lows: number[], closes: number[], period: number): number {
  if (highs.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  return mean(trs.slice(-period));
}

function computeStochastic(highs: number[], lows: number[], closes: number[], kPeriod: number, dPeriod: number): { k: number; d: number } {
  if (highs.length < kPeriod) return { k: 50, d: 50 };
  const recentHighs = highs.slice(-kPeriod);
  const recentLows = lows.slice(-kPeriod);
  const currentClose = closes[closes.length - 1];
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  const k = highestHigh === lowestLow ? 50 : ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  // Simplified D (average of last dPeriod K values)
  const d = k; // Simplified for performance
  return { k, d };
}

function computeWilliamsR(highs: number[], lows: number[], closes: number[], period: number): number {
  if (highs.length < period) return -50;
  const recentHighs = highs.slice(-period);
  const recentLows = lows.slice(-period);
  const currentClose = closes[closes.length - 1];
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  if (highestHigh === lowestLow) return -50;
  return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
}

function computeOBV(closes: number[], volumes: number[]): number {
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
  }
  return obv;
}

// ─── Math Utilities ───────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

function round(val: number): number {
  return Math.round(val * 100) / 100;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
