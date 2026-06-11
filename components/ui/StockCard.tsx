'use client';

import Link from 'next/link';
import { useCurrency } from '@/lib/currency-context';
import { formatPercent } from '@/lib/format';
import PredictionBadge from './PredictionBadge';
import Sparkline from './Sparkline';

interface StockCardProps {
  ticker: string;
  name?: string;
  price: number;
  changePercent: number;
  prediction: 'UP' | 'DOWN' | 'NEUTRAL';
  history: number[];
}

export default function StockCard({
  ticker,
  name,
  price,
  changePercent,
  prediction,
  history,
}: StockCardProps) {
  const { formatPrice } = useCurrency();
  const isPositive = changePercent >= 0;

  return (
    <Link
      href={`/stock/${ticker}`}
      className="block p-4.5 rounded-xl border border-border-custom bg-bg-card hover:bg-bg-card-hover hover:border-accent-blue/40 shadow-sm light:shadow-neutral-200/50 transition-all-custom group focus:outline-none focus:ring-2 focus:ring-accent-blue"
    >
      <div className="flex items-start justify-between mb-3.5">
        <div>
          <span className="font-mono font-bold text-base text-text-primary tracking-tight group-hover:text-accent-blue transition-colors">
            {ticker}
          </span>
          {name && (
            <p className="text-xs text-text-secondary truncate max-w-[120px]" title={name}>
              {name}
            </p>
          )}
        </div>
        <PredictionBadge direction={prediction} />
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono font-bold text-lg text-text-primary">
            {formatPrice(price)}
          </p>
          <span
            className={`font-mono text-xs font-semibold ${
              isPositive ? 'text-accent-green' : 'text-accent-red'
            }`}
          >
            {formatPercent(changePercent)}
          </span>
        </div>

        <div className="opacity-90 group-hover:opacity-100 transition-opacity">
          <Sparkline points={history} width={100} height={28} />
        </div>
      </div>
    </Link>
  );
}
