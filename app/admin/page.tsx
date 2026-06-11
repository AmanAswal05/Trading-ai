'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCurrency } from '@/lib/currency-context';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';
import { 
  Users, CreditCard, Percent, BarChart3, ShieldAlert, ArrowUpRight, 
  Search, Activity, RefreshCw, Sliders, Play, Save, RotateCcw, 
  CheckCircle2, XCircle, AlertCircle, ShieldCheck, Database, Info, Lock
} from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { TuningConfig, DEFAULT_TUNING_CONFIG } from '@/lib/prediction-engine';

interface DashboardStats {
  totalUsers: number;
  activeTrials: number;
  paidUsers: number;
  conversionRate: number;
  totalRevenue: number;
}

interface TickerVolume {
  ticker: string;
  volume: number;
}

interface PaymentRecord {
  id: string;
  user_email: string;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  created_at: string;
}

interface SubscriptionRecord {
  id: string;
  user_email: string;
  plan_name: string;
  billing_cycle: string;
  status: string;
  end_date: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { formatPrice, convert, symbol, currency } = useCurrency();
  const decimalPlaces = currency === 'JPY' ? 0 : 2;

  const formatConvertedPrice = (val: number) => {
    return `${symbol}${val.toLocaleString(undefined, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    })}`;
  };

  const convertToUsd = (amount: number, fromCurrency: string) => {
    if (fromCurrency === 'USD') return amount;
    const ratesMap: Record<string, number> = {
      INR: 83.42,
      EUR: 0.92,
      GBP: 0.79,
      AED: 3.67,
      CAD: 1.37,
      AUD: 1.50,
      JPY: 156.80,
    };
    const rate = ratesMap[fromCurrency] || 1.0;
    return amount / rate;
  };
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeTrials: 0,
    paidUsers: 0,
    conversionRate: 0,
    totalRevenue: 0,
  });

  const [tickerVolumes, setTickerVolumes] = useState<TickerVolume[]>([]);
  const [recentPayments, setRecentPayments] = useState<PaymentRecord[]>([]);
  const [recentSubscriptions, setRecentSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [isMockMode, setIsMockMode] = useState(false);
  const [dbActiveTab, setDbActiveTab] = useState<'payments' | 'subscriptions'>('payments');
  
  // Navigation Tabs: 'auditor' | 'metrics' | 'accuracy'
  const [currentTab, setCurrentTab] = useState<'auditor' | 'metrics' | 'accuracy'>('accuracy');

  // AI Auditor States
  const [auditTicker, setAuditTicker] = useState('AAPL');
  const [manualTicker, setManualTicker] = useState('');
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditResult, setAuditResult] = useState<any | null>(null);

  // Hyperparameter Tuning States
  const [tuningConfig, setTuningConfig] = useState<TuningConfig>(DEFAULT_TUNING_CONFIG);
  const [isTunedActive, setIsTunedActive] = useState(false);
  const [isConfigModified, setIsConfigModified] = useState(false);

  // Accuracy Verification States
  const [accuracyTimeframe, setAccuracyTimeframe] = useState<'7D' | '30D' | '90D' | '365D' | 'ALL'>('ALL');
  const [accuracyStats, setAccuracyStats] = useState<any>(null);
  const [loadingAccuracy, setLoadingAccuracy] = useState(false);
  const [verifyingPredictions, setVerifyingPredictions] = useState(false);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [accuracyError, setAccuracyError] = useState('');

  // Backtest Seeder Job States
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<any | null>(null);
  const [seederSize, setSeederSize] = useState<number>(10); // default to 1,000 predictions (datesCount = 10)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRequestRef = useRef<AbortController | null>(null);
  const pollingInFlightRef = useRef(false);

  // Adaptive Forecasting & Regime States
  const [indicatorPerformance, setIndicatorPerformance] = useState<any>(null);
  const [regimeStats, setRegimeStats] = useState<any>(null);
  const [runningLearning, setRunningLearning] = useState(false);

  // Read cookies helper
  const getCookie = (name: string) => {
    if (typeof window === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  };

  const loadAccuracyStats = async (tf = accuracyTimeframe) => {
    setLoadingAccuracy(true);
    setAccuracyError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/admin/accuracy-stats?timeframe=${tf}`, {
        headers,
        cache: 'no-store'
      });

      if (!res.ok) {
        throw new Error('Failed to load verified accuracy statistics');
      }

      const data = await res.json();
      setAccuracyStats(data);
    } catch (err: any) {
      console.error(err);
      setAccuracyError(err.message || 'Failed to load accuracy stats.');
    } finally {
      setLoadingAccuracy(false);
    }
  };

  const loadIndicatorPerformance = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch('/api/admin/indicator-performance', { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setIndicatorPerformance(data);
      }
    } catch (e) {
      console.error('Failed to load indicator performance:', e);
    }
  };

  const loadRegimeStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch('/api/admin/regime-stats', { headers, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setRegimeStats(data);
      }
    } catch (e) {
      console.error('Failed to load regime stats:', e);
    }
  };

  const runLearningCycle = async () => {
    setRunningLearning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/admin/run-learning', {
        method: 'POST',
        headers,
        cache: 'no-store'
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Learning cycle completed successfully.');
        await loadAccuracyStats(accuracyTimeframe);
        await loadIndicatorPerformance();
        await loadRegimeStats();
      } else {
        alert(`Learning cycle failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(err.message || 'Learning execution failed.');
    } finally {
      setRunningLearning(false);
    }
  };

  const triggerVerification = async () => {
    setVerifyingPredictions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers,
        cache: 'no-store'
      });

      if (!res.ok) {
        throw new Error('Verification request failed');
      }

      const data = await res.json();
      alert(data.message || `Successfully verified pending predictions.`);
      await loadAccuracyStats(accuracyTimeframe);
    } catch (err: any) {
      alert(err.message || 'Verification execution failed.');
    } finally {
      setVerifyingPredictions(false);
    }
  };

  const stopPollingProgress = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollingRequestRef.current?.abort();
    pollingRequestRef.current = null;
    pollingInFlightRef.current = false;
  };

  const startPollingProgress = (jobId: string) => {
    stopPollingProgress();

    const poll = async () => {
      if (pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      const controller = new AbortController();
      pollingRequestRef.current = controller;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: HeadersInit = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch(`/api/admin/backtest?jobId=${jobId}`, {
          headers,
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!res.ok) throw new Error('Failed to fetch job status');

        const job = await res.json();
        setJobProgress(job);

        if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
          stopPollingProgress();
          setRunningBacktest(false);
          // Wait 3 seconds then clear jobId to hide modal
          setTimeout(() => {
            setActiveJobId(null);
            setJobProgress(null);
          }, 3000);
          loadAccuracyStats(accuracyTimeframe);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          // Dev-server restarts and brief disconnects are recoverable on the next poll.
          console.warn('Backtest status polling temporarily unavailable:', err?.message || err);
        }
      } finally {
        if (pollingRequestRef.current === controller) {
          pollingRequestRef.current = null;
        }
        pollingInFlightRef.current = false;
      }
    };

    void poll();
    pollingIntervalRef.current = setInterval(() => void poll(), 1000);
  };

  useEffect(() => stopPollingProgress, []);

  const triggerBacktest = async (datesCount = 10) => {
    setRunningBacktest(true);
    setJobProgress({
      status: 'QUEUED',
      progress: 0,
      recordsProcessed: 0,
      totalRecords: 0,
      recordsVerified: 0,
      databaseWrites: 0,
      successRate: 0,
      executionTime: 0,
      estimatedTimeRemaining: 0,
      failures: []
    });
    // Set activeJobId to something truthy so modal opens immediately
    setActiveJobId('initializing');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Tickers list for backtesting
      const tickersToSeed = datesCount === 7 
        ? ['AAPL'] 
        : ['AAPL', 'MSFT', 'TSLA', 'RELIANCE.BSE', 'NIFTY', 'GOOGL', 'AMZN'];

      const res = await fetch('/api/admin/backtest', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tickers: tickersToSeed,
          simulationDatesCount: datesCount
        }),
        cache: 'no-store'
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Backtest simulation request failed');
      }

      const data = await res.json();
      setActiveJobId(data.jobId);
      startPollingProgress(data.jobId);
    } catch (err: any) {
      stopPollingProgress();
      alert(err.message || 'Backtest simulation failed.');
      setActiveJobId(null);
      setJobProgress(null);
      setRunningBacktest(false);
    }
  };

  const cancelBacktestJob = async () => {
    if (!activeJobId || activeJobId === 'initializing') return;
    stopPollingProgress();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      await fetch('/api/admin/backtest', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'cancel',
          jobId: activeJobId
        }),
        cache: 'no-store'
      });
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  };

  // Check auth and custom tuning on load
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        const mockUser = getCookie('sp_mock_user');
        const email = user?.email || mockUser;

        if (email && (email.toLowerCase().includes('admin') || email.toLowerCase().endsWith('@stockpredict.ai'))) {
          setIsAdmin(true);
          
          // Load configurations
          const savedTuning = getCookie('sp_ai_tuning');
          if (savedTuning) {
            try {
              const parsed = JSON.parse(savedTuning);
              setTuningConfig({ ...DEFAULT_TUNING_CONFIG, ...parsed });
              setIsTunedActive(true);
            } catch (e) {
              console.error('Failed to parse saved tuning config:', e);
            }
          }
          
          await loadAdminMetrics();
          await runAudit(savedTuning ? JSON.parse(savedTuning) : DEFAULT_TUNING_CONFIG);
          await loadAccuracyStats('ALL');
          await loadIndicatorPerformance();
          await loadRegimeStats();
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Auth verification failed:', err);
        setIsAdmin(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAdminAccess();
  }, []);

  const revenueTrendData = useMemo(() => [
    { name: 'Week 1', revenue: stats.totalRevenue * 0.15 },
    { name: 'Week 2', revenue: stats.totalRevenue * 0.35 },
    { name: 'Week 3', revenue: stats.totalRevenue * 0.55 },
    { name: 'Week 4', revenue: stats.totalRevenue * 0.82 },
    { name: 'Week 5', revenue: stats.totalRevenue },
  ], [stats.totalRevenue]);

  const convertedRevenueTrendData = useMemo(() => {
    return revenueTrendData.map((d) => ({
      ...d,
      revenue: convert(d.revenue),
    }));
  }, [revenueTrendData, convert]);

  const auditChartData = useMemo(() => {
    return auditResult?.auditHistory 
      ? [...auditResult.auditHistory].reverse().map((item: any) => ({
          date: item.date,
          price: convert(item.priceAtSignal),
          predicted: item.predictedDirection,
          actual: item.actualDirection,
          color: item.success ? '#10b981' : item.predictedDirection === 'NEUTRAL' ? '#6b7280' : '#ef4444'
        }))
      : [];
  }, [auditResult, convert]);

  const loadAdminMetrics = async () => {
    setLoading(true);
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!hasSupabase) {
      loadMockMetrics();
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch Users counts
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, created_at');

      if (usersError) throw usersError;

      // 2. Fetch Subscriptions
      const { data: subs, error: subsError } = await supabase
        .from('subscriptions')
        .select('*');

      if (subsError) throw subsError;

      // 3. Fetch Payments
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*');

      if (paymentsError) throw paymentsError;

      // 4. Fetch Ticker Searches
      const { data: searches, error: searchesError } = await supabase
        .from('stock_searches')
        .select('stock_symbol');

      if (searchesError) throw searchesError;

      const totalUsersCount = users?.length || 0;
      let activeTrialsCount = 0;
      let paidUsersCount = 0;

      (subs || []).forEach((sub: any) => {
        if (sub.status === 'Active') {
          if (sub.plan_name === 'Pro') {
            paidUsersCount++;
          } else if (sub.plan_name === 'Free' && new Date(sub.end_date) > new Date()) {
            activeTrialsCount++;
          }
        }
      });

      const conversion = totalUsersCount > 0 
        ? Number(((paidUsersCount / totalUsersCount) * 100).toFixed(1)) 
        : 0;

      const revenueSum = (payments || [])
        .filter((p: any) => p.status === 'Success')
        .reduce((sum: number, p: any) => sum + convertToUsd(Number(p.amount), p.currency), 0);

      const tickerCounts: Record<string, number> = {};
      (searches || []).forEach((s: any) => {
        const symbol = s.stock_symbol.toUpperCase();
        tickerCounts[symbol] = (tickerCounts[symbol] || 0) + 1;
      });

      const sortedTickers = Object.entries(tickerCounts)
        .map(([ticker, volume]) => ({ ticker, volume }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 7);

      const userMap = new Map((users || []).map((u: any) => [u.id, u.email]));

      const formattedPayments: PaymentRecord[] = (payments || [])
        .map((p: any) => ({
          id: p.id,
          user_email: userMap.get(p.user_id) || 'Unknown User',
          amount: Number(p.amount),
          currency: p.currency,
          provider: p.payment_provider,
          status: p.status,
          created_at: p.created_at,
        }))
        .sort((a: PaymentRecord, b: PaymentRecord) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      const formattedSubs: SubscriptionRecord[] = (subs || [])
        .map((s: any) => ({
          id: s.id,
          user_email: userMap.get(s.user_id) || 'Unknown User',
          plan_name: s.plan_name,
          billing_cycle: s.billing_cycle,
          status: s.status,
          end_date: s.end_date,
        }))
        .sort((a: SubscriptionRecord, b: SubscriptionRecord) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())
        .slice(0, 10);

      setStats({
        totalUsers: totalUsersCount,
        activeTrials: activeTrialsCount,
        paidUsers: paidUsersCount,
        conversionRate: conversion,
        totalRevenue: revenueSum,
      });

      setTickerVolumes(sortedTickers.length > 0 ? sortedTickers : [
        { ticker: 'AAPL', volume: 45 },
        { ticker: 'TSLA', volume: 38 },
        { ticker: 'MSFT', volume: 29 },
        { ticker: 'RELIANCE', volume: 22 },
        { ticker: 'NIFTY', volume: 19 },
      ]);

      setRecentPayments(formattedPayments);
      setRecentSubscriptions(formattedSubs);
      setIsMockMode(false);

    } catch (err) {
      console.error('Error fetching real admin stats:', err);
      loadMockMetrics();
    } finally {
      setLoading(false);
    }
  };

  const loadMockMetrics = () => {
    setIsMockMode(true);
    setStats({
      totalUsers: 248,
      activeTrials: 142,
      paidUsers: 28,
      conversionRate: 11.3,
      totalRevenue: 34970 / 83.42, // USD base
    });

    setTickerVolumes([
      { ticker: 'AAPL', volume: 154 },
      { ticker: 'TSLA', volume: 120 },
      { ticker: 'MSFT', volume: 98 },
      { ticker: 'NIFTY', volume: 84 },
      { ticker: 'GOOGL', volume: 72 },
      { ticker: 'AMZN', volume: 51 },
      { ticker: 'RELIANCE', volume: 44 },
    ]);

    setRecentPayments([
      { id: '1', user_email: 'premium.trader@gmail.com', amount: 999, currency: 'INR', provider: 'Stripe', status: 'Success', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: '2', user_email: 'options.pro@yahoo.com', amount: 5999, currency: 'INR', provider: 'Razorpay', status: 'Success', created_at: new Date(Date.now() - 14400000).toISOString() },
      { id: '3', user_email: 'investor.capital@outlook.com', amount: 699, currency: 'INR', provider: 'Stripe', status: 'Success', created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: '4', user_email: 'nifty.scalper@gmail.com', amount: 999, currency: 'INR', provider: 'Razorpay', status: 'Success', created_at: new Date(Date.now() - 172800000).toISOString() },
      { id: '5', user_email: 'swing.wealth@gmail.com', amount: 999, currency: 'INR', provider: 'Stripe', status: 'Failed', created_at: new Date(Date.now() - 259200000).toISOString() },
    ]);

    setRecentSubscriptions([
      { id: '1', user_email: 'premium.trader@gmail.com', plan_name: 'Pro', billing_cycle: 'Monthly', status: 'Active', end_date: new Date(Date.now() + 30 * 86400000).toISOString() },
      { id: '2', user_email: 'options.pro@yahoo.com', plan_name: 'Pro', billing_cycle: 'Yearly', status: 'Active', end_date: new Date(Date.now() + 365 * 86400000).toISOString() },
      { id: '3', user_email: 'investor.capital@outlook.com', plan_name: 'Pro', billing_cycle: 'Weekly', status: 'Active', end_date: new Date(Date.now() + 7 * 86400000).toISOString() },
      { id: '4', user_email: 'nifty.scalper@gmail.com', plan_name: 'Pro', billing_cycle: 'Monthly', status: 'Active', end_date: new Date(Date.now() + 25 * 86400000).toISOString() },
      { id: '5', user_email: 'free.explorer@gmail.com', plan_name: 'Free', billing_cycle: 'None', status: 'Expired', end_date: new Date(Date.now() - 5 * 86400000).toISOString() },
    ]);
  };

  // Run AI accuracy audit
  const runAudit = async (customConfig?: TuningConfig) => {
    setLoadingAudit(true);
    setAuditError('');
    
    const tickerToAudit = manualTicker.trim() !== '' ? manualTicker.trim().toUpperCase() : auditTicker;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/admin/audit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ticker: tickerToAudit,
          tuningConfig: customConfig || tuningConfig
        }),
        cache: 'no-store'
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to complete accuracy audit.');
      }

      const auditData = await res.json();
      setAuditResult(auditData);
    } catch (err: any) {
      console.error(err);
      setAuditError(err.message || 'Audit failed. Check ticker symbol validation.');
    } finally {
      setLoadingAudit(false);
    }
  };

  // Handle tuning sliders modifications
  const handleSliderChange = (key: keyof TuningConfig, val: number) => {
    setTuningConfig((prev) => {
      const next = { ...prev, [key]: val };
      // Check if modified from default
      const isModified = Object.keys(DEFAULT_TUNING_CONFIG).some(
        (k) => DEFAULT_TUNING_CONFIG[k as keyof TuningConfig] !== next[k as keyof TuningConfig]
      );
      setIsConfigModified(isModified);
      return next;
    });
  };

  // Save config to cookies
  const saveTuningConfig = () => {
    document.cookie = `sp_ai_tuning=${encodeURIComponent(JSON.stringify(tuningConfig))}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setIsTunedActive(true);
    setIsConfigModified(false);
    alert('AI custom parameters successfully saved. Tuned weights are now LIVE across the entire website!');
  };

  // Reset parameters to defaults
  const resetToDefault = () => {
    document.cookie = 'sp_ai_tuning=; path=/; max-age=0; SameSite=Lax';
    setTuningConfig(DEFAULT_TUNING_CONFIG);
    setIsTunedActive(false);
    setIsConfigModified(false);
    alert('AI parameters successfully reset to system defaults.');
    runAudit(DEFAULT_TUNING_CONFIG);
  };

  if (checkingAuth) {
    return <LoadingSpinner fullPage size="lg" />;
  }

  // Access Denied Render State
  if (isAdmin === false) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-bg-primary px-4 py-12 transition-theme">
        <div className="w-full max-w-md space-y-6 p-8 border border-border-custom bg-bg-card rounded-2xl shadow-lg text-center flex flex-col items-center">
          <div className="h-14 w-14 rounded-2xl bg-accent-red/10 text-accent-red border border-accent-red/25 flex items-center justify-center mb-2 animate-bounce">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              Access Denied
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed max-w-sm">
              Administrator privileges are required to view the institutional console and backtest machine learning hyperparameter configurations.
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full pt-4">
            <Link
              href="/auth/login"
              className="w-full h-11 flex items-center justify-center bg-accent-blue text-white hover:bg-opacity-90 font-semibold rounded-xl text-sm transition-all cursor-pointer"
            >
              Sign In with Admin Account
            </Link>
            <Link
              href="/dashboard"
              className="w-full h-11 flex items-center justify-center border border-border-custom bg-bg-secondary hover:bg-bg-card-hover text-text-primary font-semibold rounded-xl text-sm transition-all cursor-pointer"
            >
              Back to Terminal
            </Link>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 transition-theme space-y-6">
      
      {/* Header and Control Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-custom pb-4.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono font-bold text-accent-blue uppercase tracking-wider bg-accent-blue/10 px-2 py-0.5 rounded border border-accent-blue/20">
              Institutional Console
            </span>
            <Link
              href="/backtest"
              className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-wider bg-purple-400/10 px-2 py-0.5 rounded border border-purple-400/20 hover:bg-purple-400/20 transition-colors"
            >
              ⚗️ Backtesting Lab →
            </Link>
            {isMockMode && (
              <span className="text-[10px] font-mono font-bold text-accent-yellow bg-accent-yellow/10 px-2 py-0.5 rounded flex items-center gap-1 border border-accent-yellow/25">
                <ShieldAlert className="w-3.5 h-3.5" /> Fallback Demo Data
              </span>
            )}
            {isTunedActive && (
              <span className="text-[10px] font-mono font-bold text-premium-gold bg-premium-gold-soft/30 px-2 py-0.5 rounded flex items-center gap-1 border border-premium-gold/25 animate-pulse">
                <ShieldCheck className="w-3.5 h-3.5" /> Tuned AI Active
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-text-primary mt-1 tracking-tight">
            Admin Management Console
          </h1>
          <p className="text-xs text-text-secondary">
            Tune algorithmic parameters, analyze prediction accuracy indexes, and audit database activity
          </p>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex flex-wrap items-center bg-bg-secondary p-1 rounded-xl border border-border-custom gap-1 self-start sm:self-auto">
          <button
            onClick={() => {
              setCurrentTab('accuracy');
              loadAccuracyStats();
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.8 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
              currentTab === 'accuracy'
                ? 'bg-bg-card text-accent-blue shadow-sm font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Activity className="w-3.5 h-3.5 animate-pulse" /> Verified Accuracy
          </button>
          <button
            onClick={() => setCurrentTab('auditor')}
            className={`flex items-center gap-1.5 px-3.5 py-1.8 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
              currentTab === 'auditor'
                ? 'bg-bg-card text-accent-blue shadow-sm font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> AI Audit & Tuning
          </button>
          <button
            onClick={() => setCurrentTab('metrics')}
            className={`flex items-center gap-1.5 px-3.5 py-1.8 text-xs font-semibold rounded-lg cursor-pointer transition-all ${
              currentTab === 'metrics'
                ? 'bg-bg-card text-accent-blue shadow-sm font-semibold'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Database className="w-3.5 h-3.5" /> Database & Metrics
          </button>
        </div>
      </div>

      {/* TAB 0: ACCURACY VERIFICATION DASHBOARD */}
      {currentTab === 'accuracy' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm gap-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent-blue" />
                Performance Verification & Model Analytics
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                Audited calculations comparing AI predictions against real-world market outcomes.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-bg-secondary p-0.5 rounded-lg border border-border-custom">
                {['ALL', '7D', '30D', '90D', '365D'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      setAccuracyTimeframe(tf as any);
                      loadAccuracyStats(tf as any);
                    }}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded cursor-pointer transition-all ${
                      accuracyTimeframe === tf
                        ? 'bg-bg-card text-accent-blue shadow-xs font-bold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {tf === 'ALL' ? 'All Time' : tf}
                  </button>
                ))}
              </div>

              <button
                onClick={triggerVerification}
                disabled={verifyingPredictions}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue hover:bg-opacity-90 disabled:bg-opacity-50 text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${verifyingPredictions ? 'animate-spin' : ''}`} />
                {verifyingPredictions ? 'Verifying...' : 'Verify Expired'}
              </button>

              <button
                onClick={runLearningCycle}
                disabled={runningLearning}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-premium-gold hover:bg-opacity-90 disabled:bg-opacity-50 text-bg-main text-[11px] font-bold rounded-lg transition-all cursor-pointer"
              >
                <Activity className={`w-3 h-3 ${runningLearning ? 'animate-pulse' : ''}`} />
                {runningLearning ? 'Learning...' : 'Run Learning Cycle'}
              </button>

              <div className="flex items-center bg-bg-secondary p-0.5 rounded-lg border border-border-custom gap-1">
                <select
                  disabled={runningBacktest}
                  className="bg-transparent text-[11px] font-semibold text-text-primary outline-none border-none py-1 px-1.5 cursor-pointer"
                  value={seederSize}
                  onChange={(e) => setSeederSize(Number(e.target.value))}
                >
                  <option value={7} className="bg-bg-card text-text-primary">100 Predictions (Quick)</option>
                  <option value={10} className="bg-bg-card text-text-primary">1,000 Predictions (Medium)</option>
                  <option value={95} className="bg-bg-card text-text-primary">10,000 Predictions (Stress)</option>
                </select>
                <button
                  onClick={() => triggerBacktest(seederSize)}
                  disabled={runningBacktest}
                  className="flex items-center gap-1 px-2.5 py-1 bg-accent-blue hover:bg-opacity-90 disabled:bg-opacity-50 text-white text-[11px] font-semibold rounded transition-all cursor-pointer"
                >
                  <Play className={`w-2.5 h-2.5 ${runningBacktest ? 'animate-pulse' : ''}`} />
                  Seed
                </button>
              </div>
            </div>
          </div>

          {/* Loader or Error */}
          {loadingAccuracy && !accuracyStats && (
            <div className="flex flex-col items-center justify-center p-12 bg-bg-card border border-border-custom rounded-xl shadow-sm">
              <LoadingSpinner />
              <p className="text-xs text-text-secondary mt-2">Computing verified stats...</p>
            </div>
          )}

          {accuracyError && (
            <div className="p-4 bg-accent-red/10 border border-accent-red/20 text-accent-red rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{accuracyError}</span>
            </div>
          )}

          {/* Verification Results Dashboard stats cards */}
          {accuracyStats && (
            <>
              {accuracyStats.totalCount === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 bg-bg-card border border-border-custom rounded-xl text-center shadow-sm">
                  <Sliders className="w-12 h-12 text-text-muted mb-4 animate-bounce" />
                  <h4 className="text-sm font-bold text-text-primary">No Verified Predictions Found</h4>
                  <p className="text-xs text-text-secondary max-w-sm mt-1">
                    Click **Run Backtest Seeder** above to simulate past forecasts, then click **Verify Expired** to run the verification calculations.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    {/* Card 1: Verified Accuracy */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-accent-green opacity-15">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Verified Accuracy</span>
                      <h2 className="text-xl font-extrabold text-accent-green mt-1">
                        {accuracyStats.accuracy}%
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">Directional correctness rate</p>
                    </div>

                    {/* Card 2: Predictions Verified */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-accent-blue opacity-15">
                        <Activity className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Predictions Verified</span>
                      <h2 className="text-xl font-extrabold text-text-primary mt-1">
                        {accuracyStats.totalCount}
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">
                        Win: {accuracyStats.correctCount} | Total: {accuracyStats.predictionVolume}
                      </p>
                    </div>

                    {/* Card 3: Sharpe-like Score */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-premium-gold opacity-15">
                        <ShieldCheck className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Sharpe-like Score</span>
                      <h2 className="text-xl font-extrabold text-premium-gold mt-1">
                        {accuracyStats.sharpeScore}
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">Risk-adjusted returns metric</p>
                    </div>

                    {/* Card 4: Model Drift */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-accent-red opacity-15">
                        <Percent className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Model Drift (30d)</span>
                      <h2 className={`text-xl font-extrabold mt-1 ${accuracyStats.modelDrift >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {accuracyStats.modelDrift >= 0 ? '+' : ''}{accuracyStats.modelDrift}%
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">Last 30d vs prior 30d accuracy</p>
                    </div>

                    {/* Card 5: Win / Loss Ratio */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-text-muted opacity-15">
                        <BarChart3 className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Win / Loss Ratio</span>
                      <h2 className="text-xl font-extrabold text-text-primary mt-1">
                        {accuracyStats.winLossRatio}
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">Correct to Incorrect outcomes</p>
                    </div>

                    {/* Card 6: Median Price Error */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-text-muted opacity-15">
                        <Percent className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Median Price Error</span>
                      <h2 className="text-xl font-extrabold text-premium-gold mt-1">
                        {accuracyStats.medianError}%
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">Mean target error: {accuracyStats.avgError}%</p>
                    </div>
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Accuracy Trend Chart */}
                    <div className="lg:col-span-8 p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-accent-blue" />
                        Accuracy Trend Over Time (%)
                      </h4>
                      <div className="h-64 w-full">
                        {accuracyStats.accuracyTrend.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-text-muted">
                            Insufficient timeline data
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={accuracyStats.accuracyTrend}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={9} />
                              <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} domain={[0, 100]} />
                              <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(20,24,33,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}
                                itemStyle={{ color: '#10b981', fontSize: '11px' }}
                              />
                              <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    {/* Outcome Distribution Pie/Bar */}
                    <div className="lg:col-span-4 p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                        Prediction Outcome Spread
                      </h4>
                      <div className="h-64 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              { name: 'Correct', value: accuracyStats.correctCount, fill: '#10b981' },
                              { name: 'Partial', value: accuracyStats.partialCount, fill: '#3b82f6' },
                              { name: 'Incorrect', value: accuracyStats.incorrectCount, fill: '#ef4444' },
                              { name: 'Neutral', value: accuracyStats.neutralCount, fill: '#6b7280' },
                            ]}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={9} />
                            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'rgba(20,24,33,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* V1 vs V2 vs V3 Model Version Comparison */}
                  <div className="p-6 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-premium-gold" />
                        Model Performance Comparison (V1 vs V2 vs V3)
                      </h4>
                      <p className="text-[10px] text-text-secondary mt-1">
                        Side-by-side comparison of balanced, momentum-focused, and trend-focused AI forecasting models.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {['V1', 'V2', 'V3'].map((version) => {
                        const model = accuracyStats.accuracyByModel.find((m: any) => m.modelVersion === version) || {
                          modelVersion: version,
                          total: 0,
                          accuracy: 0,
                          avgError: 0,
                          avgConfidence: 0,
                          calibrationDeviation: 0,
                          calibrationRating: 'No Data'
                        };

                        const focus = version === 'V1' ? 'Balanced Setup' : version === 'V2' ? 'Momentum Heavy' : 'Trend Heavy';
                        const description = version === 'V1' 
                          ? 'Balanced weight allocation across indicators (MA, RSI, MACD, Volume).'
                          : version === 'V2'
                          ? 'Aggressive allocation targeting RSI momentum and MACD histogram crossovers.'
                          : 'Conservative trend allocation emphasizing 200-day moving average and price channels.';

                        const accuracies = accuracyStats.accuracyByModel.map((m: any) => m.accuracy);
                        const maxAccuracy = Math.max(...accuracies);
                        const isBest = model.accuracy === maxAccuracy && maxAccuracy > 0;

                        return (
                          <div 
                            key={version} 
                            className={`p-5 rounded-xl border transition-all ${
                              isBest 
                                ? 'border-accent-green/45 bg-accent-green/5 shadow-xs relative overflow-hidden' 
                                : 'border-border-custom bg-bg-secondary/40'
                            }`}
                          >
                            {isBest && (
                              <div className="absolute top-0 right-0 bg-accent-green text-white text-[9px] font-bold uppercase py-1 px-3 rounded-bl-lg tracking-wider">
                                Best Performer
                              </div>
                            )}
                            
                            <div className="space-y-1">
                              <span className="text-[9px] font-mono font-bold text-text-secondary uppercase">
                                {focus}
                              </span>
                              <h5 className="text-sm font-extrabold text-text-primary flex items-center gap-1.5 mt-0.5">
                                Model {version}
                              </h5>
                              <p className="text-[10.5px] text-text-secondary leading-relaxed min-h-[32px] mt-1">
                                {description}
                              </p>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-custom/40 pt-4 text-xs">
                              <div>
                                <span className="text-[9px] uppercase text-text-muted font-bold block">Forecasts</span>
                                <span className="text-xs font-extrabold text-text-primary">{model.total}</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-text-muted font-bold block">Win Rate</span>
                                <span className="text-xs font-extrabold text-accent-green">{model.accuracy.toFixed(1)}%</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-text-muted font-bold block">Avg Price Error</span>
                                <span className="text-xs font-extrabold text-premium-gold">{model.avgError.toFixed(2)}%</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-text-muted font-bold block">Calibration</span>
                                <span className={`text-[9.5px] font-bold inline-block px-1.5 py-0.5 rounded ${
                                  model.calibrationRating === 'Excellent'
                                    ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                                    : model.calibrationRating === 'Good'
                                    ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                                    : model.calibrationRating === 'Moderate'
                                    ? 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20'
                                    : 'bg-text-muted/10 text-text-muted border border-border-custom'
                                }`}>
                                  {model.calibrationRating}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Calibration chart - Full Width */}
                  <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-accent-blue" />
                        Confidence Calibration Curve
                      </h4>
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        Verifies if forecast confidence levels align with historical correctness rates (e.g. 80%+ confidence forecasts should yield 80%+ actual wins).
                      </p>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={accuracyStats.confidenceCalibration}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="bucket" stroke="rgba(255,255,255,0.4)" fontSize={9} />
                          <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(20,24,33,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                          />
                          <Bar dataKey="expectedAccuracy" name="Expected Accuracy" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.4} />
                          <Bar dataKey="actualAccuracy" name="Actual Accuracy" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Stock Breakdowns & Sector breakdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* By Stock Ticker */}
                    <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-3">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-text-primary">Accuracy by Stock</h5>
                      <div className="max-h-60 overflow-y-auto pr-1">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-border-custom text-text-secondary font-bold">
                              <th className="py-2">Ticker</th>
                              <th className="py-2 text-center">Count</th>
                              <th className="py-2 text-right">Accuracy</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-custom/30 text-text-secondary">
                            {accuracyStats.accuracyByStock.slice(0, 8).map((item: any) => (
                              <tr key={item.ticker}>
                                <td className="py-2 font-mono font-bold text-text-primary">{item.ticker}</td>
                                <td className="py-2 text-center">{item.total}</td>
                                <td className="py-2 text-right text-accent-green font-semibold">{item.accuracy.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* By Sector */}
                    <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-3">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-text-primary">Accuracy by Sector</h5>
                      <div className="max-h-60 overflow-y-auto pr-1">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-border-custom text-text-secondary font-bold">
                              <th className="py-2">Sector</th>
                              <th className="py-2 text-center">Count</th>
                              <th className="py-2 text-right">Accuracy</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-custom/30 text-text-secondary">
                            {accuracyStats.accuracyBySector.map((item: any) => (
                              <tr key={item.sector}>
                                <td className="py-2 text-text-primary font-medium">{item.sector}</td>
                                <td className="py-2 text-center">{item.total}</td>
                                <td className="py-2 text-right text-accent-green font-semibold">{item.accuracy.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* By Market */}
                    <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-3">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-text-primary">Accuracy by Market</h5>
                      <div className="max-h-60 overflow-y-auto pr-1">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-border-custom text-text-secondary font-bold">
                              <th className="py-2">Market</th>
                              <th className="py-2 text-center">Count</th>
                              <th className="py-2 text-right">Accuracy</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-custom/30 text-text-secondary">
                            {accuracyStats.accuracyByMarket.map((item: any) => (
                              <tr key={item.market}>
                                <td className="py-2 text-text-primary font-medium">{item.market}</td>
                                <td className="py-2 text-center">{item.total}</td>
                                <td className="py-2 text-right text-accent-green font-semibold">{item.accuracy.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    </div>

                    {/* SECTION 4: ADAPTIVE FORECASTING SYSTEMS (PHASES 1, 2, 3, 8) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 border-t border-border-custom/50 pt-6">
                      
                      {/* Left: Indicator Performance & Weights (7 cols) */}
                      <div className="lg:col-span-7 p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-4">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                            <Sliders className="w-4 h-4 text-premium-gold" />
                            Adaptive Indicator Performance & Weights
                          </h4>
                          <p className="text-[10px] text-text-secondary mt-1">
                            Learned weights automatically calibrated using Bayesian accuracy feedback from verified predictions.
                          </p>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px]">
                            <thead>
                              <tr className="border-b border-border-custom text-text-secondary font-bold">
                                <th className="py-2">Indicator</th>
                                <th className="py-2 text-center">Current Weight</th>
                                <th className="py-2 text-center">Previous Weight</th>
                                <th className="py-2 text-center">Reliability</th>
                                <th className="py-2 text-right">Accuracy Score</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-custom/30 text-text-secondary">
                              {indicatorPerformance?.rankings && indicatorPerformance.rankings.length > 0 ? (
                                indicatorPerformance.rankings.map((ind: any) => {
                                  const diff = ind.current_weight - ind.previous_weight;
                                  return (
                                    <tr key={ind.indicator_name} className="hover:bg-bg-secondary/20">
                                      <td className="py-2.5 font-semibold text-text-primary uppercase">{ind.indicator_name}</td>
                                      <td className="py-2.5 text-center font-mono font-bold text-text-primary">
                                        {ind.current_weight}
                                      </td>
                                      <td className="py-2.5 text-center font-mono text-text-muted">
                                        {ind.previous_weight}
                                      </td>
                                      <td className="py-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          <div className="w-12 bg-bg-secondary h-1.5 rounded-full overflow-hidden">
                                            <div 
                                              className="bg-accent-blue h-full" 
                                              style={{ width: `${ind.reliability_score}%` }}
                                            />
                                          </div>
                                          <span className="text-[10px] font-mono">{ind.reliability_score}%</span>
                                        </div>
                                      </td>
                                      <td className={`py-2.5 text-right font-extrabold ${
                                        ind.accuracy_score >= 55 
                                          ? 'text-accent-green' 
                                          : ind.accuracy_score >= 50 
                                          ? 'text-accent-yellow' 
                                          : 'text-accent-red'
                                      }`}>
                                        {ind.accuracy_score.toFixed(1)}%
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={5} className="py-8 text-center text-text-muted">
                                    No indicator stats compiled yet. Run a learning cycle to populate.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Right: Weight Adjustment History Chart (5 cols) */}
                      <div className="lg:col-span-5 p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-4">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                            Weight Adjustment History
                          </h4>
                          <p className="text-[10px] text-text-secondary mt-1">
                            Chronological history of indicator weights shifting in response to performance drift.
                          </p>
                        </div>
                        
                        <div className="h-60 w-full">
                          {indicatorPerformance?.history && indicatorPerformance.history.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart 
                                data={indicatorPerformance.history.map((snap: any, idx: number) => ({
                                  date: `Run ${idx + 1}`,
                                  'SMA 200': Math.abs(snap.weights.weightSma200 || 0),
                                  'RSI': Math.abs(snap.weights.weightRsiBullish || 0),
                                  'MACD': Math.abs(snap.weights.weightMacd || 0),
                                  'Volume': Math.abs(snap.weights.weightVolume || 0),
                                  'Bollinger': Math.abs(snap.weights.weightBbandMiddle || 0),
                                }))}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={9} />
                                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: 'rgba(20,24,33,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                />
                                <Line type="monotone" dataKey="SMA 200" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
                                <Line type="monotone" dataKey="RSI" stroke="#10b981" strokeWidth={1.5} dot={false} />
                                <Line type="monotone" dataKey="MACD" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                                <Line type="monotone" dataKey="Volume" stroke="#ec4899" strokeWidth={1.5} dot={false} />
                                <Line type="monotone" dataKey="Bollinger" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="h-full flex items-center justify-center text-xs text-text-muted">
                              Insufficient weight historical snapshots. Run learning cycles to chart.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 5: MARKET REGIMES (PHASE 2 & 8) */}
                    <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-accent-blue" />
                            Market Regime Accuracy Indexes
                          </h4>
                          <p className="text-[10px] text-text-secondary mt-1">
                            Evaluates AI forecasting model precision across distinct volatility and trend configurations.
                          </p>
                        </div>
                        
                        {regimeStats?.currentRegime && (
                          <div className="flex items-center gap-2 px-3 py-1 bg-accent-blue/15 border border-accent-blue/30 rounded-lg text-xs">
                            <span className="text-[10px] uppercase text-accent-blue font-extrabold">Current Active Regime:</span>
                            <span className="font-bold text-text-primary">{regimeStats.currentRegime.label}</span>
                            <span className="text-[10px] font-mono text-text-muted">({regimeStats.currentRegime.confidence}% conf)</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                        {regimeStats?.regimes && regimeStats.regimes.length > 0 ? (
                          regimeStats.regimes.map((reg: any) => (
                            <div key={reg.regime} className="p-4 bg-bg-secondary/35 border border-border-custom/80 rounded-xl relative overflow-hidden">
                              <span className="text-[8.5px] uppercase font-bold text-text-muted tracking-wider block leading-snug">
                                {reg.label}
                              </span>
                              <div className="flex items-baseline gap-1 mt-2">
                                <h3 className={`text-lg font-extrabold ${
                                  reg.accuracy_score >= 55 
                                    ? 'text-accent-green' 
                                    : reg.accuracy_score >= 50 
                                    ? 'text-accent-yellow' 
                                    : 'text-accent-red'
                                }`}>
                                  {reg.accuracy_score.toFixed(1)}%
                                </h3>
                                <span className="text-[9px] text-text-muted">wins</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-[9px] text-text-secondary border-t border-border-custom/40 pt-2 font-mono">
                                <span>Forecasts:</span>
                                <span className="font-bold text-text-primary">{reg.total_predictions}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[9px] text-text-secondary font-mono">
                                <span>Avg Error:</span>
                                <span className="font-bold text-premium-gold">{reg.avg_error_percentage.toFixed(2)}%</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="col-span-full py-8 text-center text-text-muted text-xs">
                            No market regime statistics compiled yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      {/* TAB 1: ACCURACY AUDITOR & HYPERPARAMETER TUNER */}
      {currentTab === 'auditor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: AI Accuracy Auditor (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Audit Control Card */}
            <div className="p-5 border border-border-custom bg-bg-card rounded-xl transition-theme space-y-4 shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Activity className="w-4 h-4 text-accent-blue" />
                    AI Forecasting Accuracy Auditor
                  </h3>
                  <p className="text-xs text-text-secondary">Simulates running predictions historically over the last 60 days to backtest accuracy</p>
                </div>
              </div>

              {/* Ticker select bar */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <span className="text-xs text-text-muted font-semibold">Select Target:</span>
                {['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN'].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setAuditTicker(t);
                      setManualTicker('');
                    }}
                    className={`h-8 px-3 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                      auditTicker === t && manualTicker === ''
                        ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30'
                        : 'border-border-custom bg-bg-secondary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                
                {/* Manual input */}
                <div className="relative flex items-center h-8">
                  <input
                    type="text"
                    placeholder="Custom (e.g. INFY)"
                    value={manualTicker}
                    onChange={(e) => setManualTicker(e.target.value)}
                    className="h-full w-28 pl-2 pr-6 border border-border-custom bg-bg-secondary rounded-lg text-xs font-mono text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none"
                  />
                  {manualTicker && (
                    <Search className="absolute right-2 w-3.5 h-3.5 text-text-muted" />
                  )}
                </div>

                <button
                  onClick={() => runAudit()}
                  disabled={loadingAudit}
                  className="flex items-center gap-1 px-4 h-8 bg-accent-blue hover:bg-opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer transition-all shadow-sm ml-auto"
                >
                  {loadingAudit ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Run Backtest
                </button>
              </div>

              {auditError && (
                <div className="p-3 border border-accent-red/25 bg-accent-red/10 text-accent-red text-xs rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{auditError}</p>
                </div>
              )}
            </div>

            {/* Audit Results Dashboard */}
            {auditResult && !loadingAudit && (
              <div className="space-y-6">
                
                {/* Visual statistics cards */}
                <div className="grid grid-cols-3 gap-4.5">
                  
                  {/* Accuracy gauge */}
                  <div className="p-4 border border-border-custom bg-bg-card rounded-xl text-center space-y-1.5 shadow-sm flex flex-col items-center justify-center">
                    <span className="text-[9px] font-mono font-bold text-text-muted uppercase tracking-wider">AI Accuracy Rate</span>
                    <div className="relative flex items-center justify-center">
                      <div className={`h-16 w-16 rounded-full border-4 flex items-center justify-center font-mono text-base font-extrabold ${
                        auditResult.accuracy >= 70 
                          ? 'border-accent-green bg-accent-green/5 text-accent-green' 
                          : auditResult.accuracy >= 50 
                          ? 'border-accent-yellow bg-accent-yellow/5 text-accent-yellow' 
                          : 'border-accent-red bg-accent-red/5 text-accent-red'
                      }`}>
                        {auditResult.accuracy}%
                      </div>
                    </div>
                  </div>

                  {/* Correct signals */}
                  <div className="p-4 border border-border-custom bg-bg-card rounded-xl text-center space-y-1 shadow-sm flex flex-col items-center justify-center">
                    <span className="text-[9px] font-mono font-bold text-text-muted uppercase tracking-wider">Correct Calls</span>
                    <p className="text-xl font-bold text-text-primary">{auditResult.correctSignals}</p>
                    <span className="text-[9px] text-text-secondary font-mono">successful forecasts</span>
                  </div>

                  {/* Total Signals */}
                  <div className="p-4 border border-border-custom bg-bg-card rounded-xl text-center space-y-1 shadow-sm flex flex-col items-center justify-center">
                    <span className="text-[9px] font-mono font-bold text-text-muted uppercase tracking-wider">Total Directional Signals</span>
                    <p className="text-xl font-bold text-text-primary">{auditResult.totalSignals}</p>
                    <span className="text-[9px] text-text-secondary font-mono">excluding neutral calls</span>
                  </div>
                </div>

                {/* Backtesting price line chart */}
                {auditChartData.length > 0 && (
                  <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Historical Price Auditing Timeline</h4>
                      <p className="text-[11px] text-text-secondary">Historical closing price with technical forecast markers</p>
                    </div>
                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={auditChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                          <XAxis 
                            dataKey="date" 
                            stroke="var(--text-muted)" 
                            fontSize={9} 
                            tickLine={false} 
                            tickFormatter={(v) => v.substring(5)}
                          />
                          <YAxis 
                            stroke="var(--text-muted)" 
                            fontSize={9} 
                            tickLine={false} 
                            axisLine={false} 
                            domain={['auto', 'auto']}
                            tickFormatter={(val) => formatConvertedPrice(val)}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'var(--bg-card)', 
                              borderColor: 'var(--border)', 
                              borderRadius: '12px',
                              fontSize: '11px',
                              color: 'var(--text-primary)'
                            }} 
                            formatter={(value) => [formatConvertedPrice(Number(value)), 'Close Price']}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="price" 
                            stroke="var(--accent-blue)" 
                            strokeWidth={2}
                            dot={(props: any) => {
                              const { cx, cy, index } = props;
                              const item = auditChartData[index];
                              if (!item || item.predicted === 'NEUTRAL') return <circle cx={cx} cy={cy} r={0} key={index} />;
                              return (
                                <circle 
                                  cx={cx} 
                                  cy={cy} 
                                  r={4} 
                                  fill={item.color} 
                                  stroke="#fff" 
                                  strokeWidth={1} 
                                  key={index} 
                                />
                              );
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex gap-4.5 justify-center text-[10px] font-mono">
                      <span className="flex items-center gap-1 text-accent-green"><span className="h-2 w-2 rounded-full bg-accent-green" /> Correct Forecast</span>
                      <span className="flex items-center gap-1 text-accent-red"><span className="h-2 w-2 rounded-full bg-accent-red" /> Incorrect Forecast</span>
                      <span className="flex items-center gap-1 text-text-muted"><span className="h-2 w-2 rounded-full bg-text-muted" /> Neutral</span>
                    </div>
                  </div>
                )}

                {/* Audit Signals Log Table */}
                <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Historical Signals Audit Log</h4>
                  <div className="overflow-y-auto max-h-80">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border-custom text-text-muted uppercase text-[9px] tracking-wider sticky top-0 bg-bg-card pb-2">
                          <th className="py-2">Date</th>
                          <th className="py-2">Price</th>
                          <th className="py-2">Price after 5D</th>
                          <th className="py-2">Forecast</th>
                          <th className="py-2">Actual (5D)</th>
                          <th className="py-2 text-right">Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-custom/50 text-text-secondary">
                        {auditResult.auditHistory.map((row: any, idx: number) => (
                          <tr key={idx} className="hover:bg-table-row-hover">
                            <td className="py-2">{row.date}</td>
                            <td className="py-2">{formatPrice(row.priceAtSignal)}</td>
                            <td className="py-2 font-semibold">
                              {formatPrice(row.price5DaysLater)}
                              <span className={`text-[10px] ml-1 ${row.priceChangePercent >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                                ({row.priceChangePercent >= 0 ? '+' : ''}{row.priceChangePercent}%)
                              </span>
                            </td>
                            <td className="py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                row.predictedDirection === 'UP' 
                                  ? 'bg-accent-green/10 text-accent-green' 
                                  : row.predictedDirection === 'DOWN' 
                                  ? 'bg-accent-red/10 text-accent-red' 
                                  : 'bg-bg-secondary text-text-muted'
                              }`}>
                                {row.predictedDirection}
                              </span>
                            </td>
                            <td className="py-2 font-bold">{row.actualDirection}</td>
                            <td className="py-2 text-right">
                              {row.predictedDirection === 'NEUTRAL' ? (
                                <span className="text-text-muted">Skipped</span>
                              ) : row.success ? (
                                <span className="inline-flex items-center gap-0.5 text-accent-green font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> Correct</span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-accent-red font-bold"><XCircle className="w-3.5 h-3.5" /> Miss</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
            
            {loadingAudit && (
              <div className="flex flex-col items-center justify-center p-20 border border-border-custom bg-bg-card rounded-xl">
                <LoadingSpinner size="md" />
                <span className="text-xs text-text-secondary mt-3 font-semibold">Running historical accuracy backtest simulation...</span>
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: AI Hyperparameter Tuning Panel (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Tuning Card */}
            <div className="p-5 border border-border-custom bg-bg-card rounded-xl transition-theme space-y-5 shadow-sm">
              <div className="flex justify-between items-start border-b border-border-custom/50 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-accent-blue" />
                    AI Hyperparameter Tuning
                  </h3>
                  <p className="text-xs text-text-secondary">Fine-tune the indicator weights and prediction thresholds</p>
                </div>
              </div>

              {/* Status info */}
              <div className="flex items-center justify-between text-xs p-3 bg-bg-secondary rounded-xl border border-border-custom">
                <div className="flex items-center gap-2">
                  {isTunedActive ? (
                    <ShieldCheck className="w-4.5 h-4.5 text-premium-gold" />
                  ) : (
                    <Info className="w-4.5 h-4.5 text-text-muted" />
                  )}
                  <div>
                    <p className="font-bold text-text-primary">
                      {isTunedActive ? 'Custom Tuned Parameters Active' : 'Running default system settings'}
                    </p>
                    <p className="text-[10px] text-text-secondary">
                      {isConfigModified 
                        ? 'Warning: Sliders changed. Click Rerun to simulate.' 
                        : 'Sliders match current active configuration.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sliders Accordion groups */}
              <div className="space-y-4 pt-1 max-h-[50vh] overflow-y-auto pr-1">
                
                {/* 1. Trend indicators */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-accent-blue uppercase tracking-wider border-b border-border-custom/30 pb-1 font-mono">1. Trend Weights</h4>
                  
                  {/* SMA 200 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">SMA 200 Weight (Long-Term)</span>
                      <span className="font-mono text-accent-blue font-bold">{tuningConfig.weightSma200} pts</span>
                    </div>
                    <input
                      type="range" min="0" max="30" step="1"
                      value={tuningConfig.weightSma200}
                      onChange={(e) => handleSliderChange('weightSma200', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>

                  {/* SMA 50 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">SMA 50 Weight (Medium-Term)</span>
                      <span className="font-mono text-accent-blue font-bold">{tuningConfig.weightSma50} pts</span>
                    </div>
                    <input
                      type="range" min="0" max="30" step="1"
                      value={tuningConfig.weightSma50}
                      onChange={(e) => handleSliderChange('weightSma50', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>

                  {/* SMA 20 */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">SMA 20 Weight (Short-Term)</span>
                      <span className="font-mono text-accent-blue font-bold">{tuningConfig.weightSma20} pts</span>
                    </div>
                    <input
                      type="range" min="0" max="30" step="1"
                      value={tuningConfig.weightSma20}
                      onChange={(e) => handleSliderChange('weightSma20', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>

                  {/* EMA Crossover */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">EMA 12/26 Crossover Weight</span>
                      <span className="font-mono text-accent-blue font-bold">{tuningConfig.weightEmaCross} pts</span>
                    </div>
                    <input
                      type="range" min="0" max="30" step="1"
                      value={tuningConfig.weightEmaCross}
                      onChange={(e) => handleSliderChange('weightEmaCross', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>
                </div>

                {/* 2. Momentum indicators */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-accent-blue uppercase tracking-wider border-b border-border-custom/30 pb-1 font-mono">2. Momentum Weights</h4>
                  
                  {/* RSI Bullish */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">RSI Bullish (50-70) Weight</span>
                      <span className="font-mono text-accent-blue font-bold">{tuningConfig.weightRsiBullish} pts</span>
                    </div>
                    <input
                      type="range" min="0" max="30" step="1"
                      value={tuningConfig.weightRsiBullish}
                      onChange={(e) => handleSliderChange('weightRsiBullish', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>

                  {/* RSI Oversold Penalty */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">RSI Oversold Penalty (&lt;30)</span>
                      <span className="font-mono text-accent-red font-bold">{tuningConfig.penaltyRsiOversold} pts</span>
                    </div>
                    <input
                      type="range" min="-30" max="0" step="1"
                      value={tuningConfig.penaltyRsiOversold}
                      onChange={(e) => handleSliderChange('penaltyRsiOversold', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>

                  {/* RSI Overbought Penalty */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">RSI Overbought Penalty (&gt;75)</span>
                      <span className="font-mono text-accent-red font-bold">{tuningConfig.penaltyRsiOverbought} pts</span>
                    </div>
                    <input
                      type="range" min="-30" max="0" step="1"
                      value={tuningConfig.penaltyRsiOverbought}
                      onChange={(e) => handleSliderChange('penaltyRsiOverbought', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>

                  {/* MACD */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">MACD Bullish Histogram Weight</span>
                      <span className="font-mono text-accent-blue font-bold">{tuningConfig.weightMacd} pts</span>
                    </div>
                    <input
                      type="range" min="0" max="30" step="1"
                      value={tuningConfig.weightMacd}
                      onChange={(e) => handleSliderChange('weightMacd', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>

                  {/* Stochastic */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">Stochastic Oscillator Weight</span>
                      <span className="font-mono text-accent-blue font-bold">{tuningConfig.weightStochastic} pts</span>
                    </div>
                    <input
                      type="range" min="0" max="30" step="1"
                      value={tuningConfig.weightStochastic}
                      onChange={(e) => handleSliderChange('weightStochastic', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>

                  {/* Williams R */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">Williams %R Weight</span>
                      <span className="font-mono text-accent-blue font-bold">{tuningConfig.weightWilliamsR} pts</span>
                    </div>
                    <input
                      type="range" min="0" max="30" step="1"
                      value={tuningConfig.weightWilliamsR}
                      onChange={(e) => handleSliderChange('weightWilliamsR', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>
                </div>

                {/* 3. Volatility & Volume */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-accent-blue uppercase tracking-wider border-b border-border-custom/30 pb-1 font-mono">3. Volatility & Volume Weights</h4>
                  
                  {/* BB Middle */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">Bollinger Bands Middle Weight</span>
                      <span className="font-mono text-accent-blue font-bold">{tuningConfig.weightBbandMiddle} pts</span>
                    </div>
                    <input
                      type="range" min="0" max="30" step="1"
                      value={tuningConfig.weightBbandMiddle}
                      onChange={(e) => handleSliderChange('weightBbandMiddle', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>

                  {/* BB Upper */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">Bollinger Bands Upper Weight</span>
                      <span className="font-mono text-accent-blue font-bold">{tuningConfig.weightBbandUpper} pts</span>
                    </div>
                    <input
                      type="range" min="0" max="30" step="1"
                      value={tuningConfig.weightBbandUpper}
                      onChange={(e) => handleSliderChange('weightBbandUpper', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>

                  {/* Volume */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">Average Volume Exceedance Weight</span>
                      <span className="font-mono text-accent-blue font-bold">{tuningConfig.weightVolume} pts</span>
                    </div>
                    <input
                      type="range" min="0" max="30" step="1"
                      value={tuningConfig.weightVolume}
                      onChange={(e) => handleSliderChange('weightVolume', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>
                </div>

                {/* 4. Decision Thresholds */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-accent-blue uppercase tracking-wider border-b border-border-custom/30 pb-1 font-mono">4. Forecast Decision Thresholds</h4>
                  
                  {/* Up threshold */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">UP Signal Confidence Threshold</span>
                      <span className="font-mono text-accent-green font-bold">&ge; {tuningConfig.upThreshold}%</span>
                    </div>
                    <input
                      type="range" min="30" max="80" step="1"
                      value={tuningConfig.upThreshold}
                      onChange={(e) => handleSliderChange('upThreshold', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>

                  {/* Down threshold */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">DOWN Signal Confidence Threshold</span>
                      <span className="font-mono text-accent-red font-bold">&le; {tuningConfig.downThreshold}%</span>
                    </div>
                    <input
                      type="range" min="20" max="70" step="1"
                      value={tuningConfig.downThreshold}
                      onChange={(e) => handleSliderChange('downThreshold', parseInt(e.target.value))}
                      className="w-full h-1 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-accent-blue"
                    />
                  </div>
                </div>

              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-3 pt-3 border-t border-border-custom/50">
                
                {/* Rerun simulation on sliders settings */}
                <button
                  onClick={() => runAudit()}
                  disabled={loadingAudit}
                  className="w-full flex items-center justify-center gap-1.5 h-10 border border-accent-blue text-accent-blue hover:bg-accent-blue/5 disabled:opacity-50 text-xs font-bold rounded-xl cursor-pointer transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                  Rerun Audit Simulation
                </button>

                <div className="grid grid-cols-2 gap-3">
                  
                  {/* Reset to defaults */}
                  <button
                    onClick={resetToDefault}
                    className="flex items-center justify-center gap-1.5 h-10 border border-border-custom bg-bg-card hover:bg-bg-card-hover text-text-primary text-xs font-semibold rounded-xl cursor-pointer transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Defaults
                  </button>

                  {/* Save config */}
                  <button
                    onClick={saveTuningConfig}
                    className="flex items-center justify-center gap-1.5 h-10 bg-accent-blue hover:bg-opacity-95 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-md shadow-accent-blue/10"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save & Apply AI
                  </button>

                </div>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* TAB 2: DATABASE STATS & METRICS */}
      {currentTab === 'metrics' && (
        <div className="space-y-6">
          
          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4.5">
            {/* Total Users */}
            <div className="p-4 border border-border-custom bg-bg-card rounded-xl flex items-center justify-between transition-theme shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Total Accounts
                </span>
                <p className="text-xl font-bold text-text-primary">{stats.totalUsers}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* Active Trials */}
            <div className="p-4 border border-border-custom bg-bg-card rounded-xl flex items-center justify-between transition-theme shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Active Trials
                </span>
                <p className="text-xl font-bold text-text-primary">{stats.activeTrials}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            {/* Paid Users */}
            <div className="p-4 border border-border-custom bg-bg-card rounded-xl flex items-center justify-between transition-theme shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Active Pro Users
                </span>
                <p className="text-xl font-bold text-text-primary">{stats.paidUsers}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            {/* Conversion rate */}
            <div className="p-4 border border-border-custom bg-bg-card rounded-xl flex items-center justify-between transition-theme shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Conversion Index
                </span>
                <p className="text-xl font-bold text-text-primary">{stats.conversionRate}%</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <Percent className="w-5 h-5" />
              </div>
            </div>

            {/* Total Revenue */}
            <div className="p-4 border border-border-custom bg-bg-card rounded-xl flex items-center justify-between transition-theme shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                  Gross Revenue
                </span>
                <p className="text-xl font-bold text-accent-blue">
                  {formatPrice(stats.totalRevenue)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Chart Layout: Search Volume vs Cumulative Sales */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Search volumes (7 cols) */}
            <div className="lg:col-span-7 p-5 border border-border-custom bg-bg-card rounded-xl transition-theme space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-accent-blue" /> Most Queried Tickers
                </h3>
                <p className="text-xs text-text-secondary">Distribution of search logs by stock symbol</p>
              </div>

              <div className="h-64 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tickerVolumes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis 
                      dataKey="ticker" 
                      stroke="var(--text-muted)" 
                      fontSize={10} 
                      fontFamily="monospace"
                      tickLine={false} 
                    />
                    <YAxis 
                      stroke="var(--text-muted)" 
                      fontSize={10} 
                      fontFamily="monospace"
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-card)', 
                        borderColor: 'var(--border)', 
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: 'var(--text-primary)'
                      }} 
                    />
                    <Bar dataKey="volume" fill="var(--accent-blue)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue progress (5 cols) */}
            <div className="lg:col-span-5 p-5 border border-border-custom bg-bg-card rounded-xl transition-theme space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-accent-blue" /> Cumulative Sales Trend
                </h3>
                <p className="text-xs text-text-secondary">Gross sales progression index over time</p>
              </div>

              <div className="h-64 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={convertedRevenueTrendData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="var(--text-muted)" 
                      fontSize={10} 
                      fontFamily="monospace"
                      tickLine={false} 
                    />
                    <YAxis 
                      stroke="var(--text-muted)" 
                      fontSize={10} 
                      fontFamily="monospace"
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(val) => formatConvertedPrice(val)}
                    />
                    <Tooltip 
                      formatter={(value) => [formatConvertedPrice(Number(value)), 'Cumulative Revenue']}
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-card)', 
                        borderColor: 'var(--border)', 
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: 'var(--text-primary)'
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="var(--accent-blue)" 
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Database Tables Section */}
          <div className="p-5 border border-border-custom bg-bg-card rounded-xl transition-theme space-y-4 shadow-sm">
            
            {/* Tab Controls */}
            <div className="flex items-center justify-between border-b border-border-custom pb-3">
              <div className="flex gap-4">
                <button
                  onClick={() => setDbActiveTab('payments')}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-all ${
                    dbActiveTab === 'payments'
                      ? 'border-accent-blue text-text-primary'
                      : 'border-transparent text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Recent Transactions
                </button>
                <button
                  onClick={() => setDbActiveTab('subscriptions')}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-all ${
                    dbActiveTab === 'subscriptions'
                      ? 'border-accent-blue text-text-primary'
                      : 'border-transparent text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Recent Subscriptions
                </button>
              </div>
              <span className="text-[10px] font-mono font-bold text-text-muted">
                Showing last 10 entries
              </span>
            </div>

            {/* Tab Contents: Payments Table */}
            {dbActiveTab === 'payments' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-custom text-text-muted font-mono uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 font-bold">Transaction ID</th>
                      <th className="py-2.5 font-bold">User Email</th>
                      <th className="py-2.5 font-bold">Amount</th>
                      <th className="py-2.5 font-bold">Provider</th>
                      <th className="py-2.5 font-bold">Status</th>
                      <th className="py-2.5 font-bold">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-custom/50 text-text-secondary font-mono">
                    {recentPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-text-muted">
                          No transactions recorded in payments table
                        </td>
                      </tr>
                    ) : (
                      recentPayments.map((pay) => (
                        <tr key={pay.id} className="hover:bg-table-row-hover">
                          <td className="py-2.5 font-semibold text-text-primary">{pay.id.substring(0, 14)}...</td>
                          <td className="py-2.5">{pay.user_email}</td>
                          <td className="py-2.5 font-bold text-text-primary">
                            {formatPrice(convertToUsd(pay.amount, pay.currency))}
                          </td>
                          <td className="py-2.5">{pay.provider}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              pay.status === 'Success' 
                                ? 'bg-accent-green/10 text-accent-green border border-accent-green/25' 
                                : 'bg-accent-red/10 text-accent-red border border-accent-red/25'
                            }`}>
                              {pay.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-text-muted">{new Date(pay.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Tab Contents: Subscriptions Table */}
            {dbActiveTab === 'subscriptions' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-custom text-text-muted font-mono uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 font-bold">Subscription ID</th>
                      <th className="py-2.5 font-bold">User Email</th>
                      <th className="py-2.5 font-bold">Plan</th>
                      <th className="py-2.5 font-bold">Billing Cycle</th>
                      <th className="py-2.5 font-bold">Status</th>
                      <th className="py-2.5 font-bold">Expiry Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-custom/50 text-text-secondary font-mono">
                    {recentSubscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-text-muted">
                          No active subscription records found
                        </td>
                      </tr>
                    ) : (
                      recentSubscriptions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-table-row-hover">
                          <td className="py-2.5 font-semibold text-text-primary">{sub.id.substring(0, 14)}...</td>
                          <td className="py-2.5">{sub.user_email}</td>
                          <td className="py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              sub.plan_name === 'Pro' 
                                ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20' 
                                : 'bg-bg-secondary text-text-secondary'
                            }`}>
                              {sub.plan_name}
                            </span>
                          </td>
                          <td className="py-2.5">{sub.billing_cycle}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sub.status === 'Active' 
                                ? 'bg-accent-green/10 text-accent-green border border-accent-green/25' 
                                : 'bg-accent-red/10 text-accent-red border border-accent-red/25'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-text-muted">{new Date(sub.end_date).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

          </div>

        </div>
      )}

    {/* Background Seeder Progress Modal */}
    {activeJobId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all">
        <div className="w-full max-w-md border border-border-custom bg-bg-card/90 rounded-2xl shadow-2xl p-6 space-y-5 flex flex-col relative overflow-hidden backdrop-filter backdrop-blur-lg">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-accent-blue animate-pulse" />
              <h3 className="text-sm font-bold text-text-primary">Backtest Seeding Job</h3>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              jobProgress?.status === 'COMPLETED'
                ? 'bg-accent-green/10 text-accent-green border border-accent-green/25'
                : jobProgress?.status === 'RUNNING'
                ? 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/25 animate-pulse'
                : jobProgress?.status === 'FAILED'
                ? 'bg-accent-red/10 text-accent-red border border-accent-red/25'
                : jobProgress?.status === 'CANCELLED'
                ? 'bg-text-muted/10 text-text-muted border border-text-muted/20'
                : 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
            }`}>
              {jobProgress?.status || 'QUEUED'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-text-secondary">Progress</span>
              <span className="text-text-primary font-mono">{jobProgress?.progress || 0}%</span>
            </div>
            <div className="w-full h-3 bg-bg-secondary rounded-full overflow-hidden border border-border-custom">
              <div 
                className="h-full bg-gradient-to-r from-accent-blue to-premium-gold transition-all duration-300 ease-out rounded-full" 
                style={{ width: `${jobProgress?.progress || 0}%` }}
              />
            </div>
          </div>

          {/* Stats Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 border border-border-custom bg-bg-secondary/40 rounded-xl">
              <span className="text-[10px] text-text-muted font-semibold block uppercase">Processed</span>
              <span className="text-sm font-bold font-mono text-text-primary mt-1 block">
                {jobProgress?.recordsProcessed || 0} / {jobProgress?.totalRecords || 0}
              </span>
            </div>
            <div className="p-3 border border-border-custom bg-bg-secondary/40 rounded-xl">
              <span className="text-[10px] text-text-muted font-semibold block uppercase">Verified Outcomes</span>
              <span className="text-sm font-bold font-mono text-text-primary mt-1 block">
                {jobProgress?.recordsVerified || 0}
              </span>
            </div>
            <div className="p-3 border border-border-custom bg-bg-secondary/40 rounded-xl">
              <span className="text-[10px] text-text-muted font-semibold block uppercase">Database Writes</span>
              <span className="text-sm font-bold font-mono text-text-primary mt-1 block">
                {jobProgress?.databaseWrites || 0}
              </span>
            </div>
            <div className="p-3 border border-border-custom bg-bg-secondary/40 rounded-xl">
              <span className="text-[10px] text-text-muted font-semibold block uppercase">Success Rate</span>
              <span className="text-sm font-bold font-mono text-accent-green mt-1 block">
                {jobProgress?.successRate || 0}%
              </span>
            </div>
          </div>

          {/* Remaining Time & Duration */}
          <div className="flex justify-between items-center text-[11px] font-mono text-text-muted">
            <span>Time: {((jobProgress?.executionTime || 0) / 1000).toFixed(1)}s</span>
            {jobProgress?.status === 'RUNNING' && jobProgress?.estimatedTimeRemaining > 0 && (
              <span className="text-accent-yellow">
                Remaining: ~{jobProgress?.estimatedTimeRemaining}s
              </span>
            )}
          </div>

          {/* Failure log indicator if any failed */}
          {jobProgress?.failures && jobProgress.failures.length > 0 && (
            <div className="p-2.5 border border-accent-red/20 bg-accent-red/5 rounded-xl text-[10px] text-accent-red max-h-20 overflow-y-auto space-y-1">
              <span className="font-bold uppercase">Errors logged:</span>
              {jobProgress.failures.map((f: string, idx: number) => (
                <div key={idx} className="font-mono">{f}</div>
              ))}
            </div>
          )}

          {/* Cancel / Action Button */}
          <div className="flex gap-2.5 pt-2">
            {(jobProgress?.status === 'RUNNING' || jobProgress?.status === 'QUEUED' || activeJobId === 'initializing') ? (
              <button
                onClick={cancelBacktestJob}
                disabled={activeJobId === 'initializing'}
                className="w-full h-10 flex items-center justify-center bg-accent-red/10 text-accent-red border border-accent-red/25 hover:bg-accent-red/20 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel Seeder Job
              </button>
            ) : (
              <button
                onClick={() => {
                  setActiveJobId(null);
                  setJobProgress(null);
                }}
                className="w-full h-10 flex items-center justify-center bg-bg-secondary hover:bg-bg-card-hover border border-border-custom text-text-primary font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>

        </div>
      </div>
    )}
  </div>
);
}
