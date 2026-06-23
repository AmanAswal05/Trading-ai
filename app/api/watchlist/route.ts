/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { StockData } from '@/types/stock';

export const dynamic = 'force-dynamic';

// Helper to authenticate user via JWT token
async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (err) {
    console.error('Auth check error:', err);
    return null;
  }
}

// In-memory mock watchlist for local fallback
let mockWatchlist = ['AAPL', 'MSFT', 'TSLA'];

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  const baseUrl = request.nextUrl.origin;
  
  let tickers: string[] = [];

  // 1. Fetch tickers from Supabase if authenticated
  if (user && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const { data, error } = await supabase
        .from('watchlist')
        .select('ticker')
        .eq('user_id', user.id);

      if (error) throw error;
      tickers = data.map((item: { ticker: string }) => item.ticker);
    } catch (err) {
      console.error('Error fetching watchlist from Supabase, using mock:', err);
      tickers = mockWatchlist;
    }
  } else {
    // Guest / Mock mode
    tickers = mockWatchlist;
  }

  // 2. Fetch live quote data for each ticker in the watchlist
  const watchlistItems = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const res = await fetch(`${baseUrl}/api/stock/${ticker}`, { cache: 'no-store' });
        if (res.ok) {
          const stockData: StockData = await res.json();
          return {
            id: ticker,
            user_id: user?.id || 'guest',
            ticker,
            added_at: new Date().toISOString(),
            price: stockData.quote.price,
            changePercent: stockData.quote.changePercent,
            history: stockData.history.slice(-30), // 30 days history for sparkline
          };
        }
      } catch (err) {
        console.error(`Error fetching live quote for watchlist item ${ticker}:`, err);
      }
      return {
        id: ticker,
        user_id: user?.id || 'guest',
        ticker,
        added_at: new Date().toISOString(),
        price: 150,
        changePercent: 0,
        history: [],
      };
    })
  );

  return NextResponse.json(watchlistItems);
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  
  try {
    const { ticker, action } = await request.json();
    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    const cleanTicker = ticker.toUpperCase();

    // 1. Handle authenticated Supabase request
    if (user && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      if (action === 'add') {
        const { error } = await supabase
          .from('watchlist')
          .upsert({ user_id: user.id, ticker: cleanTicker }, { onConflict: 'user_id,ticker' });
          
        if (error) throw error;
        return NextResponse.json({ success: true, action: 'add', ticker: cleanTicker });
      } else if (action === 'remove') {
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', user.id)
          .eq('ticker', cleanTicker);
          
        if (error) throw error;
        return NextResponse.json({ success: true, action: 'remove', ticker: cleanTicker });
      }
    }

    // 2. Handle guest/mock mode fallback
    if (action === 'add') {
      if (!mockWatchlist.includes(cleanTicker)) {
        mockWatchlist.push(cleanTicker);
      }
      return NextResponse.json({ success: true, action: 'add', ticker: cleanTicker });
    } else if (action === 'remove') {
      mockWatchlist = mockWatchlist.filter((t) => t !== cleanTicker);
      return NextResponse.json({ success: true, action: 'remove', ticker: cleanTicker });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Watchlist mutation error:', err);
    return NextResponse.json({ error: err.message || 'Operation failed' }, { status: 500 });
  }
}
