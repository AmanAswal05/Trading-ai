import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateIndicators } from '@/lib/indicators';
import { StockData, HistoricalQuote, StockQuote } from '@/types/stock';

export const dynamic = 'force-dynamic';

export function generateMockStockData(ticker: string): StockData {
  const cleanTicker = ticker.toUpperCase();
  const nameMap: Record<string, { name: string; exchange: string; price: number }> = {
    AAPL: { name: 'Apple Inc.', exchange: 'NASDAQ', price: 189.43 },
    MSFT: { name: 'Microsoft Corporation', exchange: 'NASDAQ', price: 420.55 },
    GOOGL: { name: 'Alphabet Inc.', exchange: 'NASDAQ', price: 175.30 },
    TSLA: { name: 'Tesla Inc.', exchange: 'NASDAQ', price: 177.46 },
    AMZN: { name: 'Amazon.com Inc.', exchange: 'NASDAQ', price: 185.15 },
    'RELIANCE.BSE': { name: 'Reliance Industries Ltd', exchange: 'BSE', price: 2950.00 },
    NIFTY: { name: 'NIFTY 50 Index', exchange: 'NSE', price: 22300.00 },
  };

  const info = nameMap[cleanTicker] || {
    name: `${cleanTicker} Corporation`,
    exchange: 'NYSE',
    price: 100 + Math.random() * 200,
  };

  const history: HistoricalQuote[] = [];
  let currentPrice = info.price;
  const baseDate = new Date();

  // Generate 100 days of daily data
  for (let i = 130; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    // skip weekends for realistic stock data
    const day = d.getDay();
    if (day === 0 || day === 6) continue;

    const change = currentPrice * (Math.random() - 0.485) * 0.025; // slight upward drift
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

  // Cap compact history to last 100 trading days
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

  const indicators = calculateIndicators(compactHistory);

  return {
    ticker: cleanTicker,
    name: info.name,
    exchange: info.exchange,
    currency: 'USD',
    quote,
    history: compactHistory,
    indicators,
  };
}

export async function getStockDataInternal(ticker: string): Promise<StockData> {
  const cleanTicker = ticker.toUpperCase();
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  const cacheTtlMs = 15 * 60 * 1000; // 15 minutes cache TTL

  try {
    // 1. Try to fetch from Supabase stock_cache
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
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
    }
  } catch (err) {
    console.error('Supabase read error, bypassing cache:', err);
  }

  // 2. Fetch from Alpha Vantage if API Key exists
  if (apiKey && apiKey !== 'your_alpha_vantage_key') {
    try {
      const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${cleanTicker}&apikey=${apiKey}&outputsize=compact`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      const timeSeries = data?.['Time Series (Daily)'];
      const metaData = data?.['Meta Data'];

      if (timeSeries && metaData) {
        // Format daily prices
        const history: HistoricalQuote[] = Object.entries(timeSeries)
          .map(([dateStr, val]: [string, any]) => ({
            date: dateStr,
            open: parseFloat(val['1. open']),
            high: parseFloat(val['2. high']),
            low: parseFloat(val['3. low']),
            close: parseFloat(val['4. close']),
            volume: parseInt(val['6. volume']),
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (history.length > 0) {
          const lastQuote = history[history.length - 1];
          const previousClose = history[history.length - 2]?.close || lastQuote.close;
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

          const indicators = calculateIndicators(history);

          const stockData: StockData = {
            ticker: cleanTicker,
            name: metaData['2. Symbol'] ? `${metaData['2. Symbol']} Corp` : `${cleanTicker} Inc.`,
            exchange: 'NASDAQ', // Standard default exchange
            currency: 'USD',
            quote,
            history,
            indicators,
          };

          // 3. Save to Supabase Cache in background
          if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
            try {
              await supabase
                .from('stock_cache')
                .upsert(
                  { ticker: cleanTicker, data: stockData, cached_at: new Date().toISOString() },
                  { onConflict: 'ticker' }
                );
            } catch (err) {
              console.error('Failed to cache stock data in Supabase:', err);
            }
          }

          return stockData;
        }
      } else {
        console.warn(`Alpha Vantage API rate limit or error for ${cleanTicker}. Using mock fallback.`);
      }
    } catch (err) {
      console.error(`Error querying Alpha Vantage API for ticker ${cleanTicker}:`, err);
    }
  }

  // 4. Try to return expired cache if active API query failed
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
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
  }

  // 5. Fallback to mock data
  const mockData = generateMockStockData(cleanTicker);
  
  // Save mock data to cache so subsequent requests don't hit limits
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      await supabase
        .from('stock_cache')
        .upsert(
          { ticker: cleanTicker, data: mockData, cached_at: new Date().toISOString() },
          { onConflict: 'ticker' }
        );
    } catch (err) {
      console.error('Failed to cache mock data:', err);
    }
  }

  return mockData;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker: rawTicker } = await params;
  try {
    const stockData = await getStockDataInternal(rawTicker);
    return NextResponse.json(stockData);
  } catch (err: any) {
    console.error(`Error loading stock data for ${rawTicker}:`, err);
    return NextResponse.json({ error: err.message || 'Failed to load stock data' }, { status: 500 });
  }
}
