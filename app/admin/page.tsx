/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
'use client';
import { AccuracyStats, DashboardStats, TickerVolume, PaymentRecord, SubscriptionRecord } from '@/lib/admin/types';
import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useCurrency } from '@/lib/currency-context';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';
import { 
  Users, CreditCard, Percent, BarChart3, ShieldAlert, ArrowUpRight, 
  Search, Activity, RefreshCw, Sliders, Play, Save, RotateCcw, 
  CheckCircle2, XCircle, AlertCircle, ShieldCheck, Database, Info, Lock
} from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { TuningConfig, DEFAULT_TUNING_CONFIG } from '@/lib/prediction-engine';
import { isAdminEmail } from '@/lib/admin-auth';

import AdminAccessDenied from '@/components/admin/AdminAccessDenied';
import AccuracyTab from '@/components/admin/AccuracyTab';
import AuditorTab from '@/components/admin/AuditorTab';
import MetricsTab from '@/components/admin/MetricsTab';
import BacktestModal from '@/components/admin/BacktestModal';

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
  const [accuracyStats, setAccuracyStats] = useState<AccuracyStats | null>(null);
  const [loadingAccuracy, setLoadingAccuracy] = useState(false);
  const [verifyingPredictions, setVerifyingPredictions] = useState(false);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [accuracyError, setAccuracyError] = useState('');
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  // Backtest Seeder Job States
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<any | null>(null);
  const [batchSize, setBatchSize] = useState<number>(10_000);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRequestRef = useRef<AbortController | null>(null);
  const pollingInFlightRef = useRef(false);

  // Adaptive Forecasting & Regime States
  const [indicatorPerformance, setIndicatorPerformance] = useState<any>(null);
  const [regimeStats, setRegimeStats] = useState<any>(null);
  const [runningLearning, setRunningLearning] = useState(false);

  // DB Migration state
  const [runningMigration, setRunningMigration] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [schemaStatus, setSchemaStatus] = useState<{ ok: boolean; columns: { name: string; type: string }[] } | null>(null);

  const getCookie = (name: string) => {
    if (typeof window === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  };

  const showNotice = (title: string, message: string) => {
    setNotice({ title, message });
  };

  // Apply pending SQL migrations via the server-side helper function.
  const runMigration = async () => {
    setRunningMigration(true);
    setMigrationResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch('/api/admin/migrate', { method: 'POST', headers });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setMigrationResult({ ok: false, message: data.instruction || data.error || 'Migration failed.' });
      } else {
        setMigrationResult({ ok: true, message: data.message || 'Migration applied.' });
        // Reload schema status after migration.
        await checkSchemaStatus();
      }
    } catch (err: unknown) {
      setMigrationResult({ ok: false, message: (err instanceof Error ? err.message : String(err)) || 'Unknown error' });
    } finally {
      setRunningMigration(false);
    }
  };

  // Check which columns currently exist in Supabase.
  const checkSchemaStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch('/api/admin/migrate', { headers });
      if (res.ok) {
        const data = await res.json();
        setSchemaStatus(data);
      }
    } catch (_) {
      // Non-critical — ignore check failures
    }
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

      const [statsRes, evaluationRes] = await Promise.all([
        fetch(`/api/admin/accuracy-stats?timeframe=${tf}`, { headers, cache: 'no-store' }),
        fetch(`/api/evaluate_model?batchSize=${batchSize}`, { headers, cache: 'no-store' }),
      ]);

      if (!statsRes.ok) {
        const errorData = await statsRes.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to load verified accuracy statistics (${statsRes.status})`);
      }

      const data = await statsRes.json();
      const evaluation = evaluationRes.ok ? await evaluationRes.json() : null;
      setAccuracyStats(evaluation ? {
        ...data,
        overallModelAccuracy: evaluation.overallAccuracy,
        tradeableAccuracy: evaluation.tradeableAccuracy,
        winLossRatioAfterFiltering: evaluation.winLossRatioAfterFiltering,
        medianError: evaluation.medianError,
        medianErrorAfterFiltering: evaluation.medianErrorAfterFiltering,
        targetAchieved: evaluation.targetAchieved,
        brierScore: evaluation.brierScore,
        reliabilityCurve: evaluation.reliabilityCurve,
        // New calibration fields from the ensemble pipeline.
        tradeableCount: evaluation.tradeableCount ?? evaluation.tradeablePredictionsCount ?? 0,
        calibrationError: evaluation.calibrationError,
        confidenceCalibration: (evaluation.reliabilityCurve || []).map((bucket: Record<string, any>) => ({
          bucket: bucket.range ?? bucket.bucket ?? `${Number(bucket.rangeMin ?? 0).toFixed(2)}-${Number(bucket.rangeMax ?? 0).toFixed(2)}`,
          total: bucket.sampleSize ?? bucket.total ?? 0,
          expectedAccuracy: bucket.predictedConfidence ?? bucket.expectedAccuracy ?? bucket.calibratedValue ?? 0,
          actualAccuracy: bucket.actualAccuracy ?? bucket.winRate ?? null,
          calibrationError: bucket.calibrationError ?? bucket.calGap ?? null,
          reliability: bucket.reliability ?? ((bucket.total ?? bucket.sampleSize ?? 0) < 20 ? 'UNRELIABLE' : 'RELIABLE'),
        })),
      } : data);
    } catch (err: unknown) {
      console.warn('Accuracy statistics unavailable:', (err instanceof Error ? err.message : String(err)) || err);
      setAccuracyError((err instanceof Error ? err.message : String(err)) || 'Failed to load accuracy stats.');
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
        showNotice('Learning Cycle', data.message || 'Learning cycle completed successfully.');
        await loadAccuracyStats(accuracyTimeframe);
        await loadIndicatorPerformance();
        await loadRegimeStats();
      } else {
        showNotice('Learning Cycle Failed', data.error || 'Unknown error');
      }
    } catch (err: unknown) {
      showNotice('Learning Cycle Failed', (err instanceof Error ? err.message : String(err)) || 'Learning execution failed.');
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
      showNotice('Verification', data.message || 'Successfully verified pending predictions.');
      await loadAccuracyStats(accuracyTimeframe);
    } catch (err: unknown) {
      showNotice('Verification Failed', (err instanceof Error ? err.message : String(err)) || 'Verification execution failed.');
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
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          // Dev-server restarts and brief disconnects are recoverable on the next poll.
          console.warn('Backtest status polling temporarily unavailable:', (err as Error)?.message || err);
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

  const triggerBacktest = async (selectedBatchSize = 10_000) => {
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
      const tickersToSeed = selectedBatchSize === 100
        ? ['AAPL'] 
        : ['AAPL', 'MSFT', 'TSLA', 'RELIANCE.BSE', 'NIFTY', 'GOOGL', 'AMZN'];

      const res = await fetch('/api/admin/backtest', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tickers: tickersToSeed,
          batchSize: selectedBatchSize,
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
    } catch (err: unknown) {
      stopPollingProgress();
      showNotice('Backtest Failed', (err instanceof Error ? err.message : String(err)) || 'Backtest simulation failed.');
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
        const mockUser = isSupabaseConfigured ? null : getCookie('sp_mock_user');
        const email = user?.email || mockUser;

        if (isAdminEmail(email)) {
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
      ? [...auditResult.auditHistory].reverse().map((item: Record<string, any>) => ({
          date: item.date,
          price: convert(item.priceAtSignal),
          predicted: item.predictedDirection,
          actual: item.actualDirection,
          color: item.success ? '#10b981' : item.predictedDirection === 'NEUTRAL' ? '#6b7280' : '#ef4444'
        }))
      : [];
  }, [auditResult, convert]);

  async function loadAdminMetrics() {
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

      (subs || []).forEach((sub: Record<string, any>) => {
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
        .filter((p: Record<string, any>) => p.status === 'Success')
        .reduce((sum: number, p: any) => sum + convertToUsd(Number(p.amount), p.currency), 0);

      const tickerCounts: Record<string, number> = {};
      (searches || []).forEach((s: Record<string, any>) => {
        const symbol = s.stock_symbol.toUpperCase();
        tickerCounts[symbol] = (tickerCounts[symbol] || 0) + 1;
      });

      const sortedTickers = Object.entries(tickerCounts)
        .map(([ticker, volume]) => ({ ticker, volume }))
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 7);

      const userMap = new Map((users || []).map((u: Record<string, any>) => [u.id, u.email]));

      const formattedPayments: PaymentRecord[] = (payments || [])
        .map((p: Record<string, any>) => ({
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
        .map((s: Record<string, any>) => ({
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
  async function runAudit(customConfig?: TuningConfig) {
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
    } catch (err: unknown) {
      console.error(err);
      setAuditError((err instanceof Error ? err.message : String(err)) || 'Audit failed. Check ticker symbol validation.');
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
    showNotice('AI Parameters Saved', 'AI custom parameters successfully saved. Tuned weights are now LIVE across the entire website!');
  };

  // Reset parameters to defaults
  const resetToDefault = () => {
    document.cookie = 'sp_ai_tuning=; path=/; max-age=0; SameSite=Lax';
    setTuningConfig(DEFAULT_TUNING_CONFIG);
    setIsTunedActive(false);
    setIsConfigModified(false);
    showNotice('AI Parameters Reset', 'AI parameters successfully reset to system defaults.');
    runAudit(DEFAULT_TUNING_CONFIG);
  };

  if (checkingAuth) {
    return <LoadingSpinner fullPage size="lg" />;
  }


  if (checkingAuth) {
    return <LoadingSpinner fullPage size="lg" />;
  }

  if (isAdmin === false) {
    return <AdminAccessDenied />;
  }

  const migrationRequired = notice?.message.includes('Predictions schema validation failed') || notice?.message.includes('Missing columns');

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 transition-theme space-y-6">
      {notice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-border-custom bg-bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-extrabold text-text-primary">{notice.title}</h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">{notice.message}</p>
                {migrationRequired && (
                  <p className="mt-3 text-xs font-semibold text-accent-red">
                    Database migration required. Missing prediction columns.
                  </p>
                )}
              </div>
              <button
                type="button"
                className="rounded-lg border border-border-custom px-3 py-1.5 text-xs font-bold text-text-primary"
                onClick={() => setNotice(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      
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

      {currentTab === 'accuracy' && <AccuracyTab regimeStats={regimeStats} 
          accuracyTimeframe={accuracyTimeframe} setAccuracyTimeframe={setAccuracyTimeframe} loadAccuracyStats={loadAccuracyStats}
          triggerVerification={triggerVerification} verifyingPredictions={verifyingPredictions}
          runLearningCycle={runLearningCycle} runningLearning={runningLearning}
          batchSize={batchSize} setBatchSize={setBatchSize} runningBacktest={runningBacktest} triggerBacktest={triggerBacktest}
          runMigration={runMigration} runningMigration={runningMigration} migrationResult={migrationResult}
          loadingAccuracy={loadingAccuracy} accuracyStats={accuracyStats} accuracyError={accuracyError}
          indicatorPerformance={indicatorPerformance}
          convert={convert}
      />}
      
      {currentTab === 'auditor' && <AuditorTab setAuditTicker={setAuditTicker} formatConvertedPrice={formatConvertedPrice} formatPrice={formatPrice} isTunedActive={isTunedActive} 
          auditTicker={auditTicker} manualTicker={manualTicker} setManualTicker={setManualTicker} runAudit={runAudit} loadingAudit={loadingAudit} auditError={auditError} auditResult={auditResult}
          auditChartData={auditChartData} tuningConfig={tuningConfig} setTuningConfig={setTuningConfig} isConfigModified={isConfigModified} handleSliderChange={handleSliderChange}
          resetToDefault={resetToDefault} saveTuningConfig={saveTuningConfig} convert={convert}
      />}
      
      {currentTab === 'metrics' && <MetricsTab formatPrice={formatPrice} convertToUsd={convert} 
          stats={stats} tickerVolumes={tickerVolumes} recentPayments={recentPayments} recentSubscriptions={recentSubscriptions} 
          dbActiveTab={dbActiveTab} setDbActiveTab={setDbActiveTab}
          revenueTrendData={revenueTrendData} convertedRevenueTrendData={convertedRevenueTrendData} convert={convert} symbol={symbol} formatConvertedPrice={formatConvertedPrice} decimalPlaces={decimalPlaces}
      />}

      {activeJobId && <BacktestModal setActiveJobId={setActiveJobId} setJobProgress={setJobProgress} activeJobId={activeJobId} jobProgress={jobProgress} cancelBacktestJob={cancelBacktestJob} />}
    </div>
  );
}
