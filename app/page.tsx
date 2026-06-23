'use client';

import Link from 'next/link';
import SearchBar from '@/components/dashboard/SearchBar';
import { BrainCircuit, ChevronRight, History, TrendingUp } from 'lucide-react';
import { useCurrency } from '@/lib/currency-context';
import { useEffect, useState } from 'react';

interface TapeTicker {
  symbol: string;
  price: number;
  change: number;
}

const initialTape: TapeTicker[] = [
  { symbol: 'AAPL', price: 189.43, change: 1.24 },
  { symbol: 'MSFT', price: 420.55, change: 0.45 },
  { symbol: 'GOOGL', price: 175.30, change: -0.32 },
  { symbol: 'TSLA', price: 177.46, change: 2.15 },
  { symbol: 'RELIANCE.BSE', price: 35.36, change: -0.15 }, // USD base
  { symbol: 'NIFTY', price: 265.50, change: 0.08 }, // USD base
];

export default function LandingPage() {
  const { formatPrice } = useCurrency();
  const [tape, setTape] = useState<TapeTicker[]>(initialTape);

  // Static initial tape for landing page


  return (
    <div className="relative flex flex-col justify-between min-h-[calc(100vh-4rem)] bg-bg-primary text-text-primary transition-colors duration-300 overflow-hidden">
      
      {/* Subtle static background gradients/shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-accent-primary/5 blur-[120px] transition-colors duration-300" />
        <div className="absolute bottom-[20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-accent-primary/5 blur-[140px] transition-colors duration-300" />
      </div>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 md:py-20 text-center z-10 max-w-5xl mx-auto w-full">
        
        {/* Next-Gen Price Forecasting badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-accent-primary/20 bg-accent-primary/5 text-xs font-semibold text-accent-primary mb-6 tracking-wide uppercase animate-reveal stagger-1 transition-all duration-300">
          <BrainCircuit className="w-3.5 h-3.5 animate-pulse" />
          Next-Gen Price Forecasting
        </span>

        {/* Hero Header */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-text-primary leading-tight max-w-4xl mb-4 font-sans animate-reveal stagger-2 transition-colors duration-300">
          Predict the Market with 40 Years of Insight.
        </h1>

        <p className="text-base sm:text-lg text-text-secondary max-w-3xl mb-8 leading-relaxed animate-reveal stagger-3 mx-auto transition-colors duration-300">
          Harness four decades of chart patterns, technical indicators, and market cycles. Our AI digests the history so you don't have to, delivering clear up/down stock forecasts with calculated probability.
        </p>

        {/* CTA Buttons (Flex-row, centered, placed directly below the subtitle) */}
        <div className="flex flex-row items-center justify-center gap-4 mb-12 animate-reveal stagger-4">
          <Link
            href="/dashboard"
            className="group flex items-center gap-1.5 h-12 px-6 rounded-full bg-accent-primary hover:bg-accent-hover text-sm font-semibold text-white transition-all duration-300 ease-in-out hover:scale-105 hover:brightness-110 cursor-pointer shadow-md shadow-accent-primary/10"
          >
            Enter Terminal Dashboard
            <ChevronRight className="w-4 h-4 transition-transform duration-300 ease-in-out group-hover:translate-x-[3px]" />
          </Link>
          <Link
            href="/auth/signup"
            className="flex h-12 px-6 items-center justify-center rounded-full border border-border-custom bg-bg-secondary/20 hover:bg-bg-card-hover text-sm font-semibold text-text-primary transition-all duration-300 ease-in-out hover:scale-105 cursor-pointer"
          >
            Create Free Account
          </Link>
        </div>

        {/* Search Component (Placed below the CTA buttons, max-width container) */}
        <div className="w-full max-w-2xl mb-16 relative z-20 animate-reveal stagger-5">
          <SearchBar />
        </div>

        {/* Feature Cards Grid (Placed at the bottom, 3-column CSS Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left animate-reveal stagger-5">
          {/* Card 1 */}
          <div className="group p-6 border border-border-custom bg-bg-card/85 rounded-xl shadow-sm hover:border-accent-primary hover:shadow-md hover:-translate-y-2 transition-all duration-300 ease-in-out">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary mb-4 transition-transform duration-300 ease-in-out group-hover:scale-110">
              <History className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-text-primary mb-1.5 transition-colors duration-300">Decades of Historical Depth</h3>
            <p className="text-xs text-text-secondary leading-relaxed transition-colors duration-300">
              Analyze stock history spanning up to 40 years, covering diverse market cycles and regimes.
            </p>
          </div>

          {/* Card 2 (Highlighted with dynamic border and active state) */}
          <div className="group p-6 border-2 border-accent-primary bg-bg-card/85 rounded-xl shadow-md shadow-accent-primary/5 hover:shadow-lg hover:-translate-y-2 transition-all duration-300 ease-in-out">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary mb-4 transition-transform duration-300 ease-in-out group-hover:scale-110">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-text-primary mb-1.5 transition-colors duration-300">Up/Down Probability Scoring</h3>
            <p className="text-xs text-text-secondary leading-relaxed transition-colors duration-300">
              Our ML Engine provides calculated probability for 'Up' or 'Down' stock price movements, based on deep pattern matching and history.
            </p>
          </div>

          {/* Card 3 */}
          <div className="group p-6 border border-border-custom bg-bg-card/85 rounded-xl shadow-sm hover:border-accent-primary hover:shadow-md hover:-translate-y-2 transition-all duration-300 ease-in-out">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary mb-4 transition-transform duration-300 ease-in-out group-hover:scale-110">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-text-primary mb-1.5 transition-colors duration-300">ML Pattern Recognition</h3>
            <p className="text-xs text-text-secondary leading-relaxed transition-colors duration-300">
              Our models continuously study and identify complex historical chart patterns for you, predicting their potential future outcomes.
            </p>
          </div>
        </div>
      </div>

      {/* Marquee Ticker Tape at bottom */}
      <div className="w-full bg-bg-card border-t border-border-custom py-3.5 overflow-hidden z-10 transition-colors duration-300">
        <div className="flex whitespace-nowrap gap-10 animate-[marquee_25s_linear_infinite] hover:[animation-play-state:paused] w-max">
          {/* Render tape twice for infinite looping effect */}
          {[...tape, ...tape].map((item, idx) => {
            const isPositive = item.change >= 0;
            return (
              <Link
                href={`/stock/${item.symbol}`}
                key={`${item.symbol}-${idx}`}
                className="inline-flex items-center gap-2 text-xs font-mono group transition-transform duration-300 ease-in-out hover:scale-105"
              >
                <span className="font-bold text-text-secondary group-hover:text-text-primary transition-colors duration-300 ease-in-out">
                  {item.symbol}
                </span>
                <span className="text-text-muted group-hover:text-text-secondary transition-colors duration-300 ease-in-out">
                  {formatPrice(item.price)}
                </span>
                <span className={isPositive ? 'text-accent-green' : 'text-accent-red'}>
                  {isPositive ? '▲' : '▼'} {Math.abs(item.change)}%
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tailwind marquee animation style injected */}
      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
