'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { WatchlistItem } from '@/types/stock';
import { formatPercent } from '@/lib/format';
import { useCurrency } from '@/lib/currency-context';
import Sparkline from '../ui/Sparkline';
import { Star, Trash2 } from 'lucide-react';

export default function WatchlistPanel() {
  const { formatPrice } = useCurrency();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWatchlist = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/watchlist', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to load watchlist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWatchlist();
    }, 0);
    // Poll for live pricing updates every 45 seconds
    const interval = setInterval(fetchWatchlist, 45000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  const handleRemove = async (ticker: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ticker, action: 'remove' }),
      });

      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.ticker !== ticker));
      }
    } catch (err) {
      console.error('Failed to remove ticker:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">My Watchlist</h3>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 border border-border-custom bg-bg-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider">My Watchlist</h3>
        <span className="text-[10px] font-mono bg-bg-secondary px-2 py-0.5 rounded-md text-text-secondary border border-border-custom font-semibold">
          {items.length} TICKERS
        </span>
      </div>

      {items.length === 0 ? (
        <div className="p-6 border border-border-custom border-dashed rounded-xl text-center">
          <Star className="w-5 h-5 mx-auto text-text-muted mb-2 opacity-50" />
          <p className="text-xs text-text-secondary">Watchlist is empty</p>
          <p className="text-[10px] text-text-muted mt-1">Search and click star to track stocks.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 max-h-[400px] md:max-h-[500px] overflow-y-auto pr-1">
          {items.map((item) => {
            const isPositive = (item.changePercent ?? 0) >= 0;
            const historyCloses = item.history?.map((h) => h.close) || [];
            
            return (
              <Link
                key={item.ticker}
                href={`/stock/${item.ticker}`}
                className="flex items-center justify-between p-3 rounded-xl border border-border-custom bg-bg-card hover:bg-bg-card-hover transition-all-custom group focus:outline-none focus:ring-1 focus:ring-accent-blue"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-sm text-text-primary truncate">
                      {item.ticker}
                    </span>
                    <button
                      onClick={(e) => handleRemove(item.ticker, e)}
                      className="opacity-0 group-hover:opacity-100 hover:text-accent-red text-text-muted cursor-pointer p-0.5 rounded transition-all"
                      title="Remove from Watchlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span
                    className={`font-mono text-[10px] font-semibold ${
                      isPositive ? 'text-accent-green' : 'text-accent-red'
                    }`}
                  >
                    {formatPercent(item.changePercent ?? 0)}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {historyCloses.length > 0 && (
                    <div className="opacity-80 hidden xs:block">
                      <Sparkline points={historyCloses} width={70} height={20} />
                    </div>
                  )}
                  
                  <span className="font-mono font-bold text-sm text-text-primary text-right min-w-[70px]">
                    {item.price ? formatPrice(item.price) : '—'}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
