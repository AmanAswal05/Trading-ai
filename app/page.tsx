/* eslint-disable @typescript-eslint/no-unused-vars, react/no-unescaped-entities */
'use client';

import Link from 'next/link';
import SearchBar from '@/components/dashboard/SearchBar';
import { BrainCircuit, ChevronRight, History, TrendingUp } from 'lucide-react';
import { useCurrency } from '@/lib/currency-context';
import { useEffect, useState } from 'react';
import { motion, Variants } from 'framer-motion';
import dynamic from 'next/dynamic';

const CanvasBackground = dynamic(() => import('@/components/ui/CanvasBackground'), { ssr: false });

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
};
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
      
      {/* Interactive 3D Background */}
      <CanvasBackground />

      {/* Subtle static background gradients/shapes for fallback and layering */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 mix-blend-screen">
        <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-accent-primary/5 blur-[120px] transition-colors duration-300" />
        <div className="absolute bottom-[20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-accent-primary/5 blur-[140px] transition-colors duration-300" />
      </div>

      {/* Hero Section */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 md:py-20 text-center z-10 max-w-5xl mx-auto w-full relative"
      >
        
        {/* Next-Gen Price Forecasting badge */}
        <motion.span variants={itemVariants} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-accent-primary/20 bg-accent-primary/10 text-xs font-semibold text-accent-primary mb-6 tracking-wide uppercase backdrop-blur-md shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <BrainCircuit className="w-3.5 h-3.5 animate-pulse" />
          Next-Gen Price Forecasting
        </motion.span>

        {/* Hero Header */}
        <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-text-primary leading-tight max-w-4xl mb-6 font-sans drop-shadow-sm">
          Predict the Market with <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-primary to-accent-secondary">40 Years</span> of Insight.
        </motion.h1>

        <motion.p variants={itemVariants} className="text-base sm:text-lg text-text-secondary max-w-3xl mb-10 leading-relaxed mx-auto">
          Harness four decades of chart patterns, technical indicators, and market cycles. Our AI digests the history so you don't have to, delivering clear up/down stock forecasts with calculated probability.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div variants={itemVariants} className="flex flex-row items-center justify-center gap-5 mb-14">
          <Link
            href="/dashboard"
            className="group flex items-center gap-1.5 h-12 px-7 rounded-full bg-accent-primary hover:bg-accent-hover text-sm font-semibold text-white transition-all duration-300 ease-in-out hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
          >
            Enter Terminal Dashboard
            <ChevronRight className="w-4 h-4 transition-transform duration-300 ease-in-out group-hover:translate-x-1" />
          </Link>
          <Link
            href="/auth/signup"
            className="flex h-12 px-7 items-center justify-center rounded-full border border-border-custom bg-bg-secondary/40 backdrop-blur-md hover:bg-bg-card-hover hover:border-accent-primary/50 text-sm font-semibold text-text-primary transition-all duration-300 ease-in-out hover:scale-[1.03] cursor-pointer"
          >
            Create Free Account
          </Link>
        </motion.div>

        {/* Search Component */}
        <motion.div variants={itemVariants} className="w-full max-w-2xl mb-20 relative z-20">
          <div className="absolute -inset-1 bg-gradient-to-r from-accent-primary/20 to-accent-secondary/20 rounded-2xl blur-lg opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
          <div className="relative">
            <SearchBar />
          </div>
        </motion.div>

        {/* Feature Cards Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          {/* Card 1 */}
          <div className="group p-7 border border-border-custom bg-bg-card/70 backdrop-blur-xl rounded-2xl shadow-sm hover:border-accent-primary/50 hover:shadow-lg hover:-translate-y-2 transition-all duration-300 ease-in-out">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary mb-5 transition-transform duration-300 ease-in-out group-hover:scale-110 group-hover:bg-accent-primary/20 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-text-primary mb-2">Decades of Historical Depth</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Analyze stock history spanning up to 40 years, covering diverse market cycles and regimes.
            </p>
          </div>

          {/* Card 2 */}
          <div className="group p-7 border border-accent-primary/30 bg-bg-card/80 backdrop-blur-xl rounded-2xl shadow-[0_4px_20px_rgba(16,185,129,0.05)] hover:border-accent-primary hover:shadow-[0_8px_30px_rgba(16,185,129,0.15)] hover:-translate-y-2 transition-all duration-300 ease-in-out relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/20 text-accent-primary mb-5 transition-transform duration-300 ease-in-out group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-text-primary mb-2">Up/Down Probability Scoring</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Our ML Engine provides calculated probability for 'Up' or 'Down' stock price movements, based on deep pattern matching and history.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group p-7 border border-border-custom bg-bg-card/70 backdrop-blur-xl rounded-2xl shadow-sm hover:border-accent-primary/50 hover:shadow-lg hover:-translate-y-2 transition-all duration-300 ease-in-out">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary mb-5 transition-transform duration-300 ease-in-out group-hover:scale-110 group-hover:bg-accent-primary/20 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-text-primary mb-2">ML Pattern Recognition</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Our models continuously study and identify complex historical chart patterns for you, predicting their potential future outcomes.
            </p>
          </div>
        </motion.div>
      </motion.div>

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
