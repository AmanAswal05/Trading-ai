'use client';

import { useCurrency } from '@/lib/currency-context';
import { CurrencyCode } from '@/types/stock';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const currencies: { code: CurrencyCode; label: string; symbol: string }[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
];

export default function CurrencySelector() {
  const { currency, setCurrency, isLoading } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = currencies.find((c) => c.code === currency) || currencies[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-border-custom bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary transition-all-custom font-mono text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-blue"
        aria-label="Select currency"
      >
        <span className="text-accent-blue font-bold">{selected.symbol}</span>
        <span>{selected.code}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        {isLoading && (
          <div className="w-3 h-3 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-border-custom bg-bg-card shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          {currencies.map((c) => (
            <button
              key={c.code}
              onClick={() => {
                setCurrency(c.code);
                setIsOpen(false);
              }}
              className={`flex items-center justify-between w-full px-4 py-2.5 text-sm font-mono transition-colors text-left hover:bg-bg-card-hover cursor-pointer ${
                c.code === currency
                  ? 'text-accent-blue font-semibold bg-bg-card-hover'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <span>{c.label}</span>
              <span className="text-text-muted text-xs">
                {c.symbol} {c.code}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
