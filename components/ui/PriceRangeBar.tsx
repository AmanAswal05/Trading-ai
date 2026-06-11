'use client';

import { useCurrency } from '@/lib/currency-context';

interface PriceRangeBarProps {
  currentPrice: number;
  targetLow: number;
  targetHigh: number;
}

export default function PriceRangeBar({
  currentPrice,
  targetLow,
  targetHigh,
}: PriceRangeBarProps) {
  const { formatPrice } = useCurrency();

  // Safeguard division by zero or negative bounds
  const range = targetHigh - targetLow || 1;
  const rawPct = ((currentPrice - targetLow) / range) * 100;
  const percentage = Math.min(100, Math.max(0, rawPct));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-text-secondary font-mono mb-2">
        <span>Low Target</span>
        <span className="text-text-primary font-semibold">Current</span>
        <span>High Target</span>
      </div>

      {/* Visual Slider Bar */}
      <div className="relative w-full h-2 bg-bg-secondary border border-border-custom rounded-full mb-2.5 transition-theme">
        {/* Track highlight from low to current */}
        <div
          className="absolute h-full bg-accent-blue/40 rounded-full"
          style={{ width: `${percentage}%` }}
        />
        {/* Pointer dot */}
        <div
          className="absolute w-4.5 h-4.5 -mt-1.5 bg-accent-blue border border-white dark:border-bg-card rounded-full shadow-md transition-all duration-300 ease-out cursor-default"
          style={{ left: `calc(${percentage}% - 9px)` }}
        />
      </div>

      <div className="flex items-center justify-between text-sm font-mono font-bold text-text-primary">
        <span>{formatPrice(targetLow)}</span>
        <span className="text-accent-blue">{formatPrice(currentPrice)}</span>
        <span>{formatPrice(targetHigh)}</span>
      </div>
    </div>
  );
}
