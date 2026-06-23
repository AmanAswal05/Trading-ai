'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import StockHeader from '@/components/stock/StockHeader';
import PredictionCard from '@/components/stock/PredictionCard';
import CandlestickChart from '@/components/charts/CandlestickChart';
import VolumeChart from '@/components/charts/VolumeChart';
import IndicatorPanel from '@/components/charts/IndicatorPanel';
import TechnicalSummary from '@/components/stock/TechnicalSummary';
import NewsPanel from '@/components/stock/NewsPanel';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import PaywallModal from '@/components/ui/PaywallModal';
import { StockAnalysisSkeleton } from '@/components/ui/Skeleton';
import { StockData, PredictionResult, NewsArticle } from '@/types/stock';
import { ChevronLeft, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function StockAnalysisPage() {
  const router = useRouter();
  const params = useParams();
  const ticker = (params.ticker as string || '').toUpperCase();

  const [stockData, setStockData] = useState<StockData | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Paywall controls
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [paywallReason, setPaywallReason] = useState<'limit_reached' | 'trial_expired' | 'guest_limit'>('guest_limit');

  useEffect(() => {
    // 1. Onboarding Redirect Check
    const onboardingDone = localStorage.getItem('sp_onboarding_completed') === 'true';
    if (!onboardingDone) {
      router.push('/onboarding');
      return;
    }

    if (ticker) {
      verifyPaywallAndLoadData();
    }
  }, [ticker, router]);

  async function verifyPaywallAndLoadData() {
    setLoading(true);
    setError(null);
    try {
      // 1. Perform Paywall access check
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const checkRes = await fetch('/api/paywall/check', { 
        headers,
        cache: 'no-store' 
      });

      if (!checkRes.ok) {
        throw new Error('Failed to verify API access authorization.');
      }

      const checkData = await checkRes.json();
      setAllowed(checkData.allowed);

      if (!checkData.allowed) {
        setPaywallReason(checkData.reason);
        setLoading(false);
        return; // HALT HERE! Do not execute heavy pricing/ML API calls.
      }

      // 2. Fetch stock data and predictions in parallel
      const [stockRes, predictRes, newsRes] = await Promise.all([
        fetch(`/api/stock/${ticker}`, { cache: 'no-store' }),
        fetch(`/api/predict/${ticker}`, { cache: 'no-store' }),
        fetch(`/api/news/${ticker}`, { cache: 'no-store' }),
      ]);

      if (!stockRes.ok || !predictRes.ok || !newsRes.ok) {
        throw new Error(`Pricing data or ML predictions unavailable for ticker ${ticker}.`);
      }

      const stock: StockData = await stockRes.json();
      const pred: PredictionResult = await predictRes.json();
      const newsFeed = await newsRes.json();

      setStockData(stock);
      setPrediction(pred);
      setNews(newsFeed.articles || []);

      // 3. Log the search in background & update local searches
      saveToRecentSearches(ticker);
      
      await fetch('/api/paywall/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ ticker }),
      });

    } catch (err: any) {
      console.error('Loader failed:', err);
      setError(err.message || 'Pricing and indicator data unavailable.');
    } finally {
      setLoading(false);
    }
  };

  const saveToRecentSearches = (symbol: string) => {
    try {
      const stored = localStorage.getItem('sp_recent_searches');
      let list: string[] = stored ? JSON.parse(stored) : [];
      list = list.filter((s) => s !== symbol);
      list.unshift(symbol);
      list = list.slice(0, 5);
      localStorage.setItem('sp_recent_searches', JSON.stringify(list));
    } catch (err) {
      console.error('Failed to update recent searches:', err);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <StockAnalysisSkeleton />
      </div>
    );
  }

  // Paywall Blocker State
  if (allowed === false) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 transition-theme min-h-[70vh] flex flex-col justify-center items-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Terminal
        </Link>

        <div className="flex flex-col items-center justify-center p-8 border border-border-custom bg-bg-card rounded-2xl max-w-md text-center shadow-sm">
          <div className="h-12 w-12 rounded-xl bg-accent-yellow/10 text-accent-yellow flex items-center justify-center mb-4 border border-accent-yellow/25">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-text-primary mb-1">
            Access Blocked — Upgrade Required
          </h2>
          <p className="text-xs text-text-secondary mb-5 leading-relaxed">
            {paywallReason === 'guest_limit'
              ? 'Free guest searches are limited to 2. Sign up or purchase a subscription to view historical price indicators and forecasts.'
              : 'Your active trial period has expired. Please choose a subscription package to proceed.'}
          </p>
          
          {/* Force the modal visible */}
          <PaywallModal 
            isOpen={true} 
            reason={paywallReason}
            onClose={() => router.push('/dashboard')}
          />
        </div>
      </div>
    );
  }

  if (error || !stockData || !prediction) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Terminal
        </Link>
        <div className="flex flex-col items-center justify-center p-8 border border-border-custom bg-bg-card rounded-xl max-w-md mx-auto text-center">
          <h2 className="text-base font-bold text-text-primary mb-1">
            {ticker} Data Unavailable
          </h2>
          <p className="text-xs text-text-secondary mb-5 leading-relaxed">
            {error || 'The system could not resolve historical prices or ML projections.'}
          </p>
          <button
            onClick={verifyPaywallAndLoadData}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-accent-blue text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md hover:bg-opacity-95 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Ticker Load
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 transition-theme space-y-6 animate-reveal">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Terminal
          </Link>
          <button
            onClick={verifyPaywallAndLoadData}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-primary cursor-pointer transition-colors"
            title="Refresh Stock Metrics"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* Stock Detail Header */}
        <StockHeader
          ticker={stockData.ticker}
          name={stockData.name}
          exchange={stockData.exchange}
          price={stockData.quote.price}
          changePercent={stockData.quote.changePercent}
        />

        {/* Layout Grid: Detailed analysis charts vs table summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Area: Charts & Predictions (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* AI Prediction Summary */}
            <PredictionCard
              currentPrice={stockData.quote.price}
              prediction={prediction}
            />

            {/* Historical Charts Container */}
            <div className="p-5 border border-border-custom bg-bg-card rounded-xl transition-theme space-y-4 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Historical Chart Patterns</h3>
                <p className="text-xs text-text-secondary">OHLC price wicks and daily transaction volumes</p>
              </div>
              <CandlestickChart data={stockData.history} />
              <VolumeChart data={stockData.history} />
            </div>

            {/* Overlay Indicator Panel */}
            <IndicatorPanel history={stockData.history} />
          </div>

          {/* Sidebar Area: Indicators & News (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <TechnicalSummary
              currentPrice={stockData.quote.price}
              indicators={stockData.indicators}
            />
            <NewsPanel articles={news} />
          </div>

        </div>
      </div>
    </ErrorBoundary>
  );
}
