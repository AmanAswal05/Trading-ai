'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TickerSuggestion {
  symbol: string;
  name: string;
  exchange: string;
  probability?: {
    direction: 'UP' | 'DOWN';
    label: string;
  };
}

const popularTickers: TickerSuggestion[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', probability: { direction: 'UP', label: 'UP 78%' } },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', probability: { direction: 'DOWN', label: 'DOWN 62%' } },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
  { symbol: 'RELIANCE.BSE', name: 'Reliance Industries Ltd', exchange: 'BSE' },
  { symbol: 'NIFTY', name: 'NIFTY 50 Index', exchange: 'NSE' },
];

interface SearchBarProps {
  variant?: 'default' | 'small';
}

export default function SearchBar({ variant = 'default' }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on query
  const suggestions = useMemo<TickerSuggestion[]>(() => {
    if (query.trim() === '') {
      return popularTickers;
    }
    const filtered = popularTickers.filter(
      (t) =>
        t.symbol.toLowerCase().includes(query.toLowerCase()) ||
        t.name.toLowerCase().includes(query.toLowerCase())
    );
    // If no match in presets, show a generic search suggestion for the queried text
    if (filtered.length === 0 && query.length < 10) {
      return [{ symbol: query.toUpperCase(), name: `Search for '${query.toUpperCase()}'`, exchange: 'Query' }];
    }
    return filtered;
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/stock/${query.trim().toUpperCase()}`);
      setIsOpen(false);
    }
  };

  const handleSelect = (symbol: string) => {
    router.push(`/stock/${symbol}`);
    setQuery('');
    setIsOpen(false);
  };

  const isDefault = variant === 'default';

  return (
    <div 
      className={`relative w-full ${isDefault ? 'max-w-2xl mx-auto z-30' : 'z-30'}`} 
      ref={containerRef}
    >
      <form onSubmit={handleSubmit} className="relative z-10">
        <div className="relative flex items-center">
          {isDefault ? (
            <Search className="absolute left-4.5 h-5 w-5 text-text-muted" />
          ) : (
            <Search className="absolute left-3.5 h-4 w-4 text-text-muted" />
          )}
          <input
            type="text"
            placeholder={
              isDefault
                ? 'Search symbols, indices, or company names...'
                : 'Search symbols (e.g. AAPL)...'
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className={`w-full border border-border-custom text-text-primary placeholder:text-text-muted hover:border-accent-primary/60 focus:border-accent-primary focus:outline-none focus:ring-4 focus:ring-accent-primary/15 transition-all duration-300 ease-in-out ${
              isDefault
                ? 'h-14 rounded-2xl bg-bg-card pl-13 pr-4 text-base font-mono shadow-md'
                : 'h-10 rounded-xl bg-bg-secondary pl-10 pr-4 text-sm font-mono'
            }`}
          />
        </div>
      </form>

      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 mt-3 rounded-2xl border border-border-custom bg-bg-card/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden z-35"
          >
            <div className={`${
              isDefault ? 'px-4 py-2 text-[10px]' : 'px-3.5 py-1.5 text-[9px]'
            } bg-bg-secondary/50 backdrop-blur-md font-bold text-text-muted uppercase border-b border-border-custom tracking-wider font-sans transition-theme`}>
              {query.trim() === '' ? 'Popular Asset Tickers' : 'Search Results'}
            </div>
            <div className="max-h-72 overflow-y-auto scrollbar-hide">
              {suggestions.map((s, index) => (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  key={s.symbol}
                  type="button"
                  onClick={() => handleSelect(s.symbol)}
                  className={`flex items-center justify-between w-full hover:bg-bg-card-hover transition-all duration-300 ease-in-out text-left border-b border-border-custom/50 last:border-0 cursor-pointer group ${
                    isDefault ? 'px-4.5 py-3.5' : 'px-3.5 py-2.5'
                  }`}
                >
                  <div>
                    <span className={`font-mono font-bold text-text-primary mr-3 bg-bg-secondary/80 rounded border border-border-custom ${
                      isDefault ? 'text-sm px-2 py-0.5' : 'text-xs px-1.5 py-0.5'
                    }`}>
                      {s.symbol}
                    </span>
                    <span className={`text-text-secondary font-medium group-hover:text-text-primary transition-colors ${
                      isDefault ? 'text-xs' : 'text-[11px]'
                    }`}>{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.probability && (
                      <span className={`font-mono font-bold rounded text-[9px] px-1.5 py-0.5 tracking-wide flex items-center shadow-sm ${
                        s.probability.direction === 'UP'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {s.probability.label}
                      </span>
                    )}
                    <span className={`font-mono font-bold text-text-muted bg-bg-secondary/40 rounded uppercase ${
                      isDefault ? 'text-[10px] px-1.5 py-0.5' : 'text-[9px] px-1 py-0.5'
                    }`}>
                      {s.exchange}
                    </span>
                    {isDefault ? (
                      <ChevronRight className="w-4 h-4 text-text-muted transition-transform duration-300 ease-in-out group-hover:translate-x-1 group-hover:text-accent-primary" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-text-muted transition-transform duration-300 ease-in-out group-hover:translate-x-1 group-hover:text-accent-primary" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
