import { OHLCVData, FetchOptions } from './types';

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

export async function fetchFromYahoo({ ticker, startDate, endDate }: FetchOptions): Promise<OHLCVData[]> {
  const startTs = Math.floor(new Date(startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(endDate).getTime() / 1000);

  const url = `${YAHOO_BASE}/${encodeURIComponent(ticker)}?period1=${startTs}&period2=${endTs}&interval=1d&events=history&includeAdjustedClose=true`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Yahoo Finance API returned status ${res.status}`);
    }

    const json = await res.json();
    return parseYahooResponse(json, ticker);
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseYahooResponse(json: any, ticker: string): OHLCVData[] {
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

    const bars: OHLCVData[] = [];

    for (let i = 0; i < timestamps.length; i++) {
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
        source: 'Yahoo',
      });
    }

    return bars;
  } catch (err) {
    console.error(`[YahooData] Parse error for ${ticker}:`, err);
    throw new Error('Failed to parse Yahoo data');
  }
}

function round(val: number): number {
  return Math.round(val * 100) / 100;
}
