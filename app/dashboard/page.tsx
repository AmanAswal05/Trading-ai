/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import WatchlistPanel from '@/components/dashboard/WatchlistPanel';
import MarketOverview from '@/components/dashboard/MarketOverview';
import SearchBar from '@/components/dashboard/SearchBar';
import StockCard from '@/components/ui/StockCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PaywallModal from '@/components/ui/PaywallModal';
import { StockCardSkeleton } from '@/components/ui/Skeleton';
import { StockData, PredictionResult } from '@/types/stock';
import { History, LayoutDashboard, Sparkles, ShieldCheck, Clock, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface RecentStockItem {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  prediction: 'UP' | 'DOWN' | 'NEUTRAL';
  history: number[];
}

interface SubscriptionStatus {
  allowed: boolean;
  plan: string;
  trialDaysLeft?: number;
  reason: string;
  searchCount?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [recentStocks, setRecentStocks] = useState<RecentStockItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  
  // Paywall Modal Control
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<'limit_reached' | 'trial_expired' | 'guest_limit'>('guest_limit');

  useEffect(() => {
    // 1. Onboarding Redirect Check
    const onboardingDone = localStorage.getItem('sp_onboarding_completed') === 'true';
    if (!onboardingDone) {
      router.push('/onboarding');
      return;
    }

    // 2. Fetch subscription/usage check
    async function checkSubscription() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch('/api/paywall/check', { 
          headers,
          cache: 'no-store' 
        });
        
        if (res.ok) {
          const statusData = await res.json();
          setSubStatus(statusData);

          // If the user's trial is expired, show paywall immediately to lock them out of the terminal
          if (!statusData.allowed && statusData.reason === 'trial_expired') {
            setPaywallReason('trial_expired');
            setShowPaywall(true);
          }
        }
      } catch (err) {
        console.error('Failed to resolve subscription paywall check:', err);
      }
    }

    // 3. Load recent searches
    async function loadRecentSearches() {
      setLoadingRecent(true);
      
      let tickers: string[] = [];
      try {
        const stored = localStorage.getItem('sp_recent_searches');
        if (stored) {
          tickers = JSON.parse(stored);
        }
      } catch (err) {
        console.error('Failed to parse recent searches:', err);
      }

      if (tickers.length === 0) {
        tickers = ['AAPL', 'MSFT', 'TSLA', 'GOOGL', 'AMZN'];
      }

      const activeTickers = tickers.slice(0, 5);

      try {
        const fetchedItems = await Promise.all(
          activeTickers.map(async (ticker) => {
            try {
              const stockRes = await fetch(`/api/stock/${ticker}`, { cache: 'no-store' });
              const predictRes = await fetch(`/api/predict/${ticker}`, { cache: 'no-store' });
              
              if (stockRes.ok && predictRes.ok) {
                const stock: StockData = await stockRes.json();
                const predict: PredictionResult = await predictRes.json();
                return {
                  ticker,
                  name: stock.name,
                  price: stock.quote.price,
                  changePercent: stock.quote.changePercent,
                  prediction: predict.direction,
                  history: stock.history.slice(-30).map((h) => h.close),
                } as RecentStockItem;
              }
            } catch (err) {
              console.error(`Error loading dashboard item ${ticker}:`, err);
            }
            return null;
          })
        );

        setRecentStocks(fetchedItems.filter((item): item is RecentStockItem => item !== null));
      } catch (err) {
        console.error('Error fetching dashboard stock metrics:', err);
      } finally {
        setLoadingRecent(false);
      }
    }

    checkSubscription();
    loadRecentSearches();
  }, [router]);

  const handleUpgradeTrigger = () => {
    setPaywallReason(subStatus?.plan === 'Guest' ? 'guest_limit' : 'trial_expired');
    setShowPaywall(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 transition-theme">
      
      {/* Title Header with Sub Badges */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 border-b border-border-custom pb-4.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent-primary">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              Financial Analysis Terminal
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Monitor index pricing, evaluate indicators, and trace watchlisted equities
            </p>
          </div>
        </div>

        {/* Subscription Status Pill */}
        {subStatus && (
          <div className="flex items-center gap-3 self-start md:self-auto">
            {subStatus.plan === 'Admin' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-accent-blue/20 text-accent-blue border border-accent-blue/30 rounded-full text-xs font-bold font-mono animate-pulse">
                <ShieldCheck className="w-3.5 h-3.5" /> ADMIN TERMINAL BYPASS
              </div>
            ) : subStatus.plan === 'Pro' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-premium-gold-soft/30 text-premium-gold border border-premium-gold/25 rounded-full text-xs font-bold font-mono">
                <ShieldCheck className="w-3.5 h-3.5" /> PRO TERMINAL ACTIVE
              </div>
            ) : subStatus.plan === 'Free' ? (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/25 rounded-full text-xs font-bold font-mono">
                <Clock className="w-3.5 h-3.5" /> TRIAL: {subStatus.trialDaysLeft} DAYS LEFT
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-bg-secondary text-text-secondary border border-border-custom rounded-full text-xs font-bold font-mono">
                <Sparkles className="w-3.5 h-3.5" /> GUEST: {subStatus.searchCount}/2 SEARCHES
              </div>
            )}

            {subStatus.plan !== 'Pro' && subStatus.plan !== 'Admin' && (
              <button
                onClick={handleUpgradeTrigger}
                className="flex items-center gap-1 px-3.5 h-8 bg-accent-primary hover:bg-accent-hover text-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm"
              >
                <Zap className="w-3 h-3" /> Upgrade
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid Layout: Watchlist Sidebar vs Main Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Sidebar Watchlist: 3 cols */}
        <aside className="md:col-span-3 border border-border-custom bg-bg-card p-4.5 rounded-xl md:sticky md:top-22 transition-theme animate-reveal stagger-1">
          <WatchlistPanel />
        </aside>

        {/* Main Dashboard Space: 9 cols */}
        <section className="md:col-span-9 space-y-6 animate-reveal stagger-2">
          
          {/* Indices Overview */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Market Indices
            </h2>
            <MarketOverview />
          </div>

          {/* Central Autocomplete Search */}
          <div className="py-2 border-y border-border-custom/50 relative z-20">
            <SearchBar />
          </div>

          {/* Recent Searches / Focus stocks */}
          <div className="space-y-4">
            <div className="flex items-center gap-1.8 text-text-muted">
              <History className="w-4 h-4" />
              <h2 className="text-xs font-bold uppercase tracking-wider">
                Recent Market Searches
              </h2>
            </div>

            {loadingRecent ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
                <StockCardSkeleton />
                <StockCardSkeleton />
                <StockCardSkeleton />
              </div>
            ) : recentStocks.length === 0 ? (
              <div className="p-12 border border-border-custom border-dashed rounded-xl text-center text-xs text-text-secondary">
                No active searches. Tickers you search will appear here.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5 animate-reveal stagger-3">
                {recentStocks.map((stock) => (
                  <StockCard
                    key={stock.ticker}
                    ticker={stock.ticker}
                    name={stock.name}
                    price={stock.price}
                    changePercent={stock.changePercent}
                    prediction={stock.prediction}
                    history={stock.history}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Paywall Blocker Overlay Modal */}
      <PaywallModal 
        isOpen={showPaywall} 
        onClose={subStatus?.reason === 'trial_expired' ? undefined : () => setShowPaywall(false)}
        reason={paywallReason}
      />

    </div>
  );
}
