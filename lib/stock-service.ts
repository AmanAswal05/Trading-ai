import { supabase } from '@/lib/supabase';
import { calculateIndicators } from '@/lib/indicators';
import { StockData, HistoricalQuote, StockQuote } from '@/types/stock';

export function generateMockStockData(ticker: string): StockData {
  const cleanTicker = ticker.toUpperCase();
  const nameMap: Record<string, { name: string; exchange: string; price: number }> = {
    AAPL: { name: 'Apple Inc.', exchange: 'NASDAQ', price: 189.43 },
    MSFT: { name: 'Microsoft Corporation', exchange: 'NASDAQ', price: 420.55 },
    GOOGL: { name: 'Alphabet Inc.', exchange: 'NASDAQ', price: 175.3 },
    TSLA: { name: 'Tesla Inc.', exchange: 'NASDAQ', price: 177.46 },
    AMZN: { name: 'Amazon.com Inc.', exchange: 'NASDAQ', price: 185.15 },
    'RELIANCE.BSE': { name: 'Reliance Industries Ltd', exchange: 'BSE', price: 2950 },
    NIFTY: { name: 'NIFTY 50 Index', exchange: 'NSE', price: 22300 },
  };

  const info = nameMap[cleanTicker] || {
    name: `${cleanTicker} Corporation`,
    exchange: 'NYSE',
    price: 100 + Math.random() * 200,
  };

  const history: HistoricalQuote[] = [];
  let currentPrice = info.price;
  const baseDate = new Date();

  for (let i = 130; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    const day = d.getDay();
    if (day === 0 || day === 6) continue;

    const change = currentPrice * (Math.random() - 0.485) * 0.025;
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + Math.random() * (currentPrice * 0.008);
    const low = Math.min(open, close) - Math.random() * (currentPrice * 0.008);
    const volume = Math.floor(500000 + Math.random() * 20000000);

    history.push({
      date: d.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    currentPrice = close;
  }

  const compactHistory = history.slice(-100);
  const lastQuote = compactHistory[compactHistory.length - 1];
  const previousClose = compactHistory[compactHistory.length - 2]?.close || lastQuote.close * 0.98;
  const changePercent = ((lastQuote.close - previousClose) / previousClose) * 100;

  const quote: StockQuote = {
    price: lastQuote.close,
    open: lastQuote.open,
    high: lastQuote.high,
    low: lastQuote.low,
    volume: lastQuote.volume,
    changePercent: Number(changePercent.toFixed(2)),
    previousClose: Number(previousClose.toFixed(2)),
  };

  return {
    ticker: cleanTicker,
    name: info.name,
    exchange: info.exchange,
    currency: 'USD',
    quote,
    history: compactHistory,
    indicators: calculateIndicators(compactHistory),
  };
}

async function getCachedStockData(cleanTicker: string, cacheTtlMs: number): Promise<StockData | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  try {
    const { data: cached, error } = await supabase
      .from('stock_cache')
      .select('*')
      .eq('ticker', cleanTicker)
      .single();

    if (cached && !error) {
      const cacheAge = Date.now() - new Date(cached.cached_at).getTime();
      if (cacheAge < cacheTtlMs) {
        return cached.data as StockData;
      }
    }
  } catch (err) {
    console.error('Supabase read error, bypassing cache:', err);
  }

  return null;
}

async function cacheStockData(cleanTicker: string, stockData: StockData, label: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

  try {
    await supabase
      .from('stock_cache')
      .upsert(
        { ticker: cleanTicker, data: stockData, cached_at: new Date().toISOString() },
        { onConflict: 'ticker' }
      );
  } catch (err) {
    console.error(`Failed to cache ${label} in Supabase:`, err);
  }
}

async function getExpiredCachedStockData(cleanTicker: string): Promise<StockData | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

  try {
    const { data: expiredCache } = await supabase
      .from('stock_cache')
      .select('data')
      .eq('ticker', cleanTicker)
      .single();

    if (expiredCache?.data) {
      return expiredCache.data as StockData;
    }
  } catch (err) {
    console.error('Failed to retrieve expired cache:', err);
  }

  return null;
}

export async function getStockDataInternal(ticker: string): Promise<StockData> {
  const cleanTicker = ticker.toUpperCase();
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  const cacheTtlMs = 15 * 60 * 1000;

  const cached = await getCachedStockData(cleanTicker, cacheTtlMs);
  if (cached) return cached;

  if (apiKey && apiKey !== 'your_alpha_vantage_key') {
    try {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${cleanTicker}&apikey=${apiKey}&outputsize=compact`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      const timeSeries = data?.['Time Series (Daily)'];
      const metaData = data?.['Meta Data'];

      if (timeSeries && metaData) {
        const history: HistoricalQuote[] = Object.entries(timeSeries)
          .map(([dateStr, val]) => {
            const row = val as Record<string, string>;
            return {
              date: dateStr,
              open: parseFloat(row['1. open']),
              high: parseFloat(row['2. high']),
              low: parseFloat(row['3. high'] ? row['3. high'] : row['3. low']),
              close: parseFloat(row['4. close']),
              volume: parseInt(row['6. volume']),
            };
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (history.length > 0) {
          const lastQuote = history[history.length - 1];
          const previousClose = history[history.length - 2]?.close || lastQuote.close;
          const changePercent = ((lastQuote.close - previousClose) / previousClose) * 100;

          const stockData: StockData = {
            ticker: cleanTicker,
            name: metaData['2. Symbol'] ? `${metaData['2. Symbol']} Corp` : `${cleanTicker} Inc.`,
            exchange: 'NASDAQ',
            currency: 'USD',
            quote: {
              price: lastQuote.close,
              open: lastQuote.open,
              high: lastQuote.high,
              low: lastQuote.low,
              volume: lastQuote.volume,
              changePercent: Number(changePercent.toFixed(2)),
              previousClose: Number(previousClose.toFixed(2)),
            },
            history,
            indicators: calculateIndicators(history),
          };

          await cacheStockData(cleanTicker, stockData, 'stock data');
          return stockData;
        }
      } else {
        console.warn(`Alpha Vantage API rate limit or error for ${cleanTicker}. Using mock fallback.`);
      }
    } catch (err) {
      console.error(`Error querying Alpha Vantage API for ticker ${cleanTicker}:`, err);
    }
  }

  const expiredCache = await getExpiredCachedStockData(cleanTicker);
  if (expiredCache) return expiredCache;

  const mockData = generateMockStockData(cleanTicker);
  await cacheStockData(cleanTicker, mockData, 'mock data');
  return mockData;
}
