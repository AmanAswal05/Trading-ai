'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/lib/currency-context';
import { formatPercent } from '@/lib/format';
import { Star, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StockHeaderProps {
  ticker: string;
  name: string;
  exchange: string;
  price: number;
  changePercent: number;
}

export default function StockHeader({
  ticker,
  name,
  exchange,
  price,
  changePercent,
}: StockHeaderProps) {
  const { formatPrice } = useCurrency();
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function checkWatchlist() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && active) {
          const { data } = await supabase
            .from('watchlist')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('ticker', ticker.toUpperCase())
            .single();

          if (active) {
            setIsWatchlisted(!!data);
          }
        }
      } catch (err) {
        console.error('Error checking watchlist state:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkWatchlist();
    return () => {
      active = false;
    };
  }, [ticker]);

  const toggleWatchlist = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ticker: ticker.toUpperCase(),
          action: isWatchlisted ? 'remove' : 'add',
        }),
      });

      if (res.ok) {
        setIsWatchlisted(!isWatchlisted);
      }
    } catch (err) {
      console.error('Failed to update watchlist:', err);
    }
  };

  const isPositive = changePercent >= 0;
  const absoluteChange = Math.abs(price * (changePercent / 100));

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-border-custom bg-bg-card transition-theme">
      {/* Title & Metadata */}
      <div className="flex items-start gap-4">
        <button
          onClick={toggleWatchlist}
          disabled={loading}
          className={`flex h-11 w-11 items-center justify-center rounded-xl border cursor-pointer transition-all ${
            isWatchlisted
              ? 'bg-accent-yellow/10 border-accent-yellow text-accent-yellow'
              : 'border-border-custom bg-bg-secondary text-text-muted hover:text-text-primary'
          }`}
          title={isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
        >
          <Star className={`w-5 h-5 ${isWatchlisted ? 'fill-accent-yellow' : ''}`} />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="font-mono font-bold text-xl sm:text-2xl text-text-primary tracking-tight">
              {ticker}
            </h1>
            <span className="text-[10px] font-mono font-bold bg-bg-secondary px-2 py-0.5 rounded border border-border-custom text-text-secondary uppercase">
              {exchange}
            </span>
          </div>
          <p className="text-sm text-text-secondary truncate max-w-sm sm:max-w-md">{name}</p>
        </div>
      </div>

      {/* Ticker Pricing details */}
      <div className="flex items-baseline md:items-end md:flex-col gap-2.5 md:gap-1 text-left md:text-right">
        <span className="font-mono font-bold text-2xl sm:text-3xl text-text-primary tracking-tight">
          {formatPrice(price)}
        </span>
        <div className="flex items-center gap-1.5 font-mono text-sm font-semibold">
          <span className={isPositive ? 'text-accent-green' : 'text-accent-red'}>
            {formatPercent(changePercent)}
          </span>
          <span className="text-text-muted">
            ({isPositive ? '+' : '-'}{formatPrice(absoluteChange)})
          </span>
          {isPositive ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-green/10 text-accent-green">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-red/10 text-accent-red">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
