'use client';

import { useEffect, useState } from 'react';
import { useCurrency } from '@/lib/currency-context';
import { formatPercent } from '@/lib/format';
import Sparkline from '../ui/Sparkline';

interface IndexData {
  name: string;
  ticker: string;
  priceUsd: number;
  changePercent: number;
  history: number[];
}

const initialIndices: IndexData[] = [
  {
    name: 'S&P 500',
    ticker: 'SPX',
    priceUsd: 5120.30,
    changePercent: 0.24,
    history: [5070, 5085, 5100, 5095, 5110, 5115, 5120],
  },
  {
    name: 'NASDAQ Composite',
    ticker: 'IXIC',
    priceUsd: 16185.10,
    changePercent: 0.45,
    history: [16010, 16080, 16120, 16090, 16140, 16160, 16185],
  },
  {
    name: 'NIFTY 50',
    ticker: 'NSEI',
    // 265.50 * 83.42 = ~22,148 INR (representing NIFTY value in converted form)
    priceUsd: 265.50,
    changePercent: -0.12,
    history: [267.2, 266.5, 266.0, 265.4, 265.9, 265.6, 265.5],
  },
  {
    name: 'BSE SENSEX',
    ticker: 'BSESN',
    // 873.00 * 83.42 = ~72,825 INR
    priceUsd: 873.00,
    changePercent: -0.08,
    history: [878.5, 876.0, 874.8, 873.2, 874.1, 873.5, 873.0],
  },
];

export default function MarketOverview() {
  const { formatPrice } = useCurrency();
  const [indices, setIndices] = useState<IndexData[]>(initialIndices);

  useEffect(() => {
    // Tick market prices every 5 seconds to simulate an active trading desk
    const interval = setInterval(() => {
      setIndices((prev) =>
        prev.map((idx) => {
          const tickPct = (Math.random() - 0.485) * 0.0006; // upward bias
          const newPrice = idx.priceUsd * (1 + tickPct);
          const originalPrice = initialIndices.find((i) => i.ticker === idx.ticker)?.priceUsd || idx.priceUsd;
          const newChangePct = ((newPrice - originalPrice) / originalPrice) * 100 + idx.changePercent;
          
          const newHistory = [...idx.history.slice(1), newPrice * (idx.history[0] / idx.priceUsd)];

          return {
            ...idx,
            priceUsd: Number(newPrice.toFixed(2)),
            changePercent: Number(newChangePct.toFixed(2)),
            history: newHistory,
          };
        })
      );
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 w-full">
      {indices.map((idx) => {
        const isPositive = idx.changePercent >= 0;
        
        return (
          <div
            key={idx.ticker}
            className="p-4 rounded-xl border border-border-custom bg-bg-card transition-theme hover:border-accent-blue/25 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-secondary truncate max-w-[140px]">
                {idx.name}
              </span>
              <span className="font-mono text-[10px] bg-bg-secondary px-1.5 py-0.5 rounded text-text-muted border border-border-custom">
                {idx.ticker}
              </span>
            </div>
            
            <div className="flex items-end justify-between">
              <div>
                <p className="font-mono font-bold text-base text-text-primary tracking-tight">
                  {formatPrice(idx.priceUsd)}
                </p>
                <span
                  className={`font-mono text-xs font-semibold ${
                    isPositive ? 'text-accent-green' : 'text-accent-red'
                  }`}
                >
                  {formatPercent(idx.changePercent)}
                </span>
              </div>
              
              <div className="opacity-80">
                <Sparkline points={idx.history} width={75} height={22} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
