'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { CurrencyCode } from '../types/stock';
import { supabase } from './supabase';

interface CurrencyContextType {
  currency: CurrencyCode;
  symbol: string;
  rate: number;
  convert: (usdValue: number) => number;
  formatPrice: (usdValue: number) => string;
  setCurrency: (code: CurrencyCode) => void;
  isLoading: boolean;
}

const CurrencySymbols: Record<CurrencyCode, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
};

const FallbackRates: Record<CurrencyCode, number> = {
  USD: 1.0,
  INR: 83.42,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  CAD: 1.37,
  AUD: 1.50,
  JPY: 156.80,
};

const ALL_CURRENCIES: CurrencyCode[] = ['USD', 'INR', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'JPY'];

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('USD');
  const [rates, setRates] = useState<Record<CurrencyCode, number>>(FallbackRates);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load user choice from localStorage & DB
  useEffect(() => {
    const stored = localStorage.getItem('sp_currency') as CurrencyCode | null;
    let timer: NodeJS.Timeout | null = null;
    if (stored && ALL_CURRENCIES.includes(stored)) {
      timer = setTimeout(() => {
        setCurrencyState(stored);
      }, 0);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.id) {
        try {
          const { data } = await supabase
            .from('users')
            .select('currency_preference')
            .eq('id', session.user.id)
            .single();
          if (data?.currency_preference && ALL_CURRENCIES.includes(data.currency_preference)) {
            setCurrencyState(data.currency_preference as CurrencyCode);
            localStorage.setItem('sp_currency', data.currency_preference);
          }
        } catch (err) {
          console.error('Failed to load user currency preference from DB:', err);
        }
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  // Fetch exchange rates on load
  useEffect(() => {
    let active = true;
    async function fetchRates() {
      try {
        const res = await fetch('/api/exchange-rates');
        if (!res.ok) throw new Error('API response not OK');
        const data = await res.json();
        if (active && data && data.rates) {
          setRates(data.rates);
        }
      } catch (err) {
        console.error('Failed to fetch rates, using fallback values:', err);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    fetchRates();
    return () => {
      active = false;
    };
  }, []);

  const setCurrency = async (code: CurrencyCode) => {
    setCurrencyState(code);
    localStorage.setItem('sp_currency', code);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (userId && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        await supabase
          .from('users')
          .update({ currency_preference: code })
          .eq('id', userId);

        await supabase
          .from('settings')
          .update({ currency: code })
          .eq('user_id', userId);
      }
    } catch (err) {
      console.error('Failed to save currency preference to DB:', err);
    }
  };

  const rate = rates[currency] ?? FallbackRates[currency] ?? 1.0;
  const symbol = CurrencySymbols[currency] ?? '$';

  const convert = (usdValue: number) => {
    return usdValue * rate;
  };

  const formatPrice = (usdValue: number) => {
    const converted = convert(usdValue);
    const decimalPlaces = currency === 'JPY' ? 0 : 2;
    return `${symbol}${converted.toLocaleString(undefined, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    })}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        symbol,
        rate,
        convert,
        formatPrice,
        setCurrency,
        isLoading,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
