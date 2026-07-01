'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import PageCover from '@/components/ui/PageCover';

interface ScannerResult {
  ticker: string;
  pattern: string;
  breakoutStatus: string;
  entry: number | null;
  stopLoss: number | null;
  target: number | null;
  riskReward: number | null;
  hasValidTradePlan: boolean;
  confidence: number;
  tradeable: boolean;
  tradeType: string;
  tradeabilityScore: number;
  price: number;
  source: string;
  rejectionReasons: string[];
  opportunityScore: number;
  support: number | null;
  resistance: number | null;
  breakoutLevel: number | null;
  multiTimeframeScore: number;
  dailyTrend: string;
  weeklyTrend: string;
  monthlyTrend: string;
  sector: string;
  sectorScore: number;
  sectorClassification: string;
  rsScore: number;
  rsClassification: string;
  rs20: number;
  rs50: number;
  rs100: number;
  volCurrent: number;
  volAvg20D: number;
  volRvol: number;
  volClassification: string;
}

export default function ScannerPage() {
  const [results, setResults] = useState<ScannerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<number>(30);
  const [metrics, setMetrics] = useState<any>(null);

  const validateResults = (rawResults: any[]): ScannerResult[] => {
    return rawResults.map(r => ({
      ...r,
      ticker: r.ticker || 'UNKNOWN',
      pattern: r.pattern || 'No Clear Pattern',
      breakoutStatus: r.breakoutStatus || 'WATCHING',
      entry: typeof r.entry === 'number' ? r.entry : null,
      stopLoss: typeof r.stopLoss === 'number' ? r.stopLoss : null,
      target: typeof r.target === 'number' ? r.target : null,
      riskReward: typeof r.riskReward === 'number' && !isNaN(r.riskReward) ? r.riskReward : null,
      hasValidTradePlan: !!r.hasValidTradePlan,
      confidence: typeof r.confidence === 'number' && !isNaN(r.confidence) ? r.confidence : 50,
      tradeable: !!r.tradeable,
      tradeType: r.tradeType || 'REJECTED',
      tradeabilityScore: typeof r.tradeabilityScore === 'number' ? r.tradeabilityScore : 0,
      opportunityScore: typeof r.opportunityScore === 'number' && !isNaN(r.opportunityScore) ? r.opportunityScore : 50,
      rejectionReasons: Array.isArray(r.rejectionReasons) ? r.rejectionReasons : [],
      support: typeof r.support === 'number' ? r.support : null,
      resistance: typeof r.resistance === 'number' ? r.resistance : null,
      breakoutLevel: typeof r.breakoutLevel === 'number' ? r.breakoutLevel : null,
      multiTimeframeScore: typeof r.multiTimeframeScore === 'number' ? r.multiTimeframeScore : 25,
      dailyTrend: r.dailyTrend || 'NEUTRAL',
      weeklyTrend: r.weeklyTrend || 'NEUTRAL',
      monthlyTrend: r.monthlyTrend || 'NEUTRAL',
      sector: r.sector || '',
      sectorScore: typeof r.sectorScore === 'number' ? r.sectorScore : 50,
      sectorClassification: r.sectorClassification || 'NEUTRAL',
      rsScore: typeof r.rsScore === 'number' ? r.rsScore : 50,
      rsClassification: r.rsClassification || 'AVERAGE',
      rs20: typeof r.rs20 === 'number' ? r.rs20 : 0,
      rs50: typeof r.rs50 === 'number' ? r.rs50 : 0,
      rs100: typeof r.rs100 === 'number' ? r.rs100 : 0,
    }));
  };

  useEffect(() => {
    let active = true;
    
    const fetchScannerData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/scanner?limit=${limit}`);
        if (!res.ok) {
          throw new Error('Failed to fetch scanner data');
        }
        const data = await res.json();
        if (active) {
          const resultsArray = Array.isArray(data) ? data : data.results || [];
          setResults(validateResults(resultsArray));
          if (data.metrics) setMetrics(data.metrics);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'An error occurred while scanning.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchScannerData();

    return () => {
      active = false;
    };
  }, [limit]);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/scanner?limit=${limit}`);
      if (!res.ok) {
        throw new Error('Failed to fetch scanner data');
      }
      const data = await res.json();
      const resultsArray = Array.isArray(data) ? data : data.results || [];
      setResults(validateResults(resultsArray));
      if (data.metrics) setMetrics(data.metrics);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while scanning.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BREAKOUT_CONFIRMED':
        return 'text-accent-green bg-accent-green/10 border-accent-green/20';
      case 'NEAR_BREAKOUT':
        return 'text-accent-blue bg-accent-blue/10 border-accent-blue/20';
      case 'WATCHING':
        return 'text-text-secondary bg-bg-secondary border-border-custom';
      case 'REJECTED':
      case 'FAILED_BREAKOUT':
        return 'text-accent-red bg-accent-red/10 border-accent-red/20';
      default:
        return 'text-text-secondary bg-bg-secondary border-border-custom';
    }
  };

  const getTradeTypeStyle = (type: string) => {
    switch (type) {
      case 'HIGH_CONVICTION':
        return 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]';
      case 'TRADEABLE':
        return 'bg-transparent text-accent-green border-accent-green/30';
      case 'WATCHLIST':
        return 'bg-transparent text-yellow-500 border-yellow-500/30';
      case 'REJECTED':
      default:
        return 'bg-transparent text-accent-red border-accent-red/30';
    }
  };
  
  const formatValue = (val: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val);
  };
  
  const getTrendName = (char: string) => {
    if (char === 'B') return 'Bullish';
    if (char === 'N') return 'Neutral';
    if (char === 'R') return 'Bearish';
    return char;
  };

  const renderRegimeBadge = (title: string, regimeData: any) => {
    if (!regimeData) return null;
    let colorClass = 'text-text-secondary bg-bg-secondary border-border-custom';
    let icon = '🟡';
    
    switch (regimeData.regime) {
      case 'STRONG_BULL':
        colorClass = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        icon = '🟢';
        break;
      case 'BULL':
        colorClass = 'text-accent-green bg-accent-green/10 border-accent-green/20';
        icon = '🟢';
        break;
      case 'BEAR':
        colorClass = 'text-orange-500 bg-orange-500/10 border-orange-500/20';
        icon = '🔴';
        break;
      case 'STRONG_BEAR':
        colorClass = 'text-accent-red bg-accent-red/10 border-accent-red/20';
        icon = '🔴';
        break;
      default:
        colorClass = 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        icon = '🟡';
        break;
    }
    
    const formattedRegime = regimeData.regime.replace('_', ' ');
    
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-bold tracking-wide ${colorClass}`}>
        <span className="text-[10px] uppercase opacity-80">{title}:</span>
        <span>{icon} {formattedRegime} MARKET | VIX {regimeData.vix}</span>
      </div>
    );
  };

  const renderMtfBadge = (daily: string, weekly: string, monthly: string, score: number) => {
    const formatTrend = (trend: string) => trend.charAt(0).toUpperCase();
    const d = formatTrend(daily);
    const w = formatTrend(weekly);
    const m = formatTrend(monthly);
    
    let icon = '🟡';
    let colorClass = 'text-yellow-500';
    
    if (score >= 90) {
      icon = '🟢';
      colorClass = 'text-emerald-500';
    } else if (score >= 75) {
      icon = '🟢';
      colorClass = 'text-accent-green';
    } else if (score >= 50) {
      icon = '🟡';
      colorClass = 'text-yellow-500';
    } else {
      icon = '🔴';
      colorClass = 'text-accent-red';
    }
    
    const tooltipText = `Daily: ${getTrendName(d)}\nWeekly: ${getTrendName(w)}\nMonthly: ${getTrendName(m)}`;
    
    return (
      <div className="flex flex-col items-center justify-center gap-0.5 cursor-help" title={tooltipText}>
        <div className={`text-xs font-bold tracking-widest ${colorClass}`}>
          {icon} {d}/{w}/{m}
        </div>
        <div className={`text-[10px] font-semibold opacity-80 ${colorClass}`}>
          Score: {score}
        </div>
      </div>
    );
  };

  const renderSectorBadge = (sector: string, score: number, classification: string) => {
    if (!sector) return <span className="text-text-secondary">—</span>;
    
    let icon = '🟡';
    let colorClass = 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    let labelColor = 'text-yellow-500';
    
    if (classification === 'VERY_STRONG') {
      icon = '🔥';
      colorClass = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      labelColor = 'text-emerald-500';
    } else if (classification === 'STRONG') {
      icon = '🟢';
      colorClass = 'text-accent-green bg-accent-green/10 border-accent-green/20';
      labelColor = 'text-accent-green';
    } else if (classification === 'NEUTRAL') {
      icon = '🟡';
      colorClass = 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      labelColor = 'text-yellow-500';
    } else if (classification === 'WEAK') {
      icon = '🔴';
      colorClass = 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      labelColor = 'text-orange-500';
    } else if (classification === 'VERY_WEAK') {
      icon = '🔴';
      colorClass = 'text-accent-red bg-accent-red/10 border-accent-red/20';
      labelColor = 'text-accent-red';
    }

    const formattedSector = sector.replace(/_/g, ' ');

    return (
      <div className="group/sector relative inline-flex items-center cursor-help">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase ${colorClass}`}>
          <span>{icon}</span>
          <span>{formattedSector}</span>
        </span>
        <div className="opacity-0 group-hover/sector:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-[200px] p-3 bg-bg-tertiary border border-border-custom rounded-lg shadow-xl text-left z-50 pointer-events-none">
          <p className="text-xs font-bold text-text-primary mb-1">{formattedSector} Sector</p>
          <div className="text-[11px] text-text-secondary flex flex-col gap-0.5">
            <span className="flex justify-between w-32"><span>Strength:</span> <span className="text-text-primary font-medium">{score}</span></span>
            <span className="flex justify-between w-32"><span>Class:</span> <span className={`${labelColor} font-medium`}>{classification?.replace('_', ' ')}</span></span>
          </div>
        </div>
      </div>
    );
  };

  const renderRSBadge = (score: number, classification: string, rs20: number, rs50: number, rs100: number) => {
    let icon = '🟡';
    let colorClass = 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    let labelColor = 'text-yellow-500';
    
    if (classification === 'LEADER') {
      icon = '🔥';
      colorClass = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      labelColor = 'text-emerald-500';
    } else if (classification === 'STRONG') {
      icon = '🟢';
      colorClass = 'text-accent-green bg-accent-green/10 border-accent-green/20';
      labelColor = 'text-accent-green';
    } else if (classification === 'WEAK') {
      icon = '🟠';
      colorClass = 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      labelColor = 'text-orange-500';
    } else if (classification === 'LAGGARD') {
      icon = '🔴';
      colorClass = 'text-accent-red bg-accent-red/10 border-accent-red/20';
      labelColor = 'text-accent-red';
    }

    return (
      <div className="group/rs relative inline-flex items-center cursor-help">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase ${colorClass}`}>
          <span>{icon}</span>
          <span>{classification}</span>
        </span>
        <div className="opacity-0 group-hover/rs:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-[200px] p-3 bg-bg-tertiary border border-border-custom rounded-lg shadow-xl text-left z-50 pointer-events-none">
          <p className="text-xs font-bold text-text-primary mb-1">Relative Strength: {score}</p>
          <div className="text-[11px] text-text-secondary flex flex-col gap-0.5">
            <span className="flex justify-between w-32"><span>20D:</span> <span className={rs20 > 0 ? 'text-accent-green font-medium' : 'text-accent-red font-medium'}>{rs20 > 0 ? '+' : ''}{rs20}%</span></span>
            <span className="flex justify-between w-32"><span>50D:</span> <span className={rs50 > 0 ? 'text-accent-green font-medium' : 'text-accent-red font-medium'}>{rs50 > 0 ? '+' : ''}{rs50}%</span></span>
            <span className="flex justify-between w-32"><span>100D:</span> <span className={rs100 > 0 ? 'text-accent-green font-medium' : 'text-accent-red font-medium'}>{rs100 > 0 ? '+' : ''}{rs100}%</span></span>
          </div>
        </div>
      </div>
    );
  };

  const renderVOLBadge = (classification: string, rvol: number, currentVol: number, avgVol20: number) => {
    let icon = '🟡';
    let colorClass = 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    let label = 'NORMAL';
    
    if (classification === 'INSTITUTIONAL_ACCUMULATION') {
      icon = '🔥';
      colorClass = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      label = 'INST BUYING';
    } else if (classification === 'STRONG_BUYING') {
      icon = '🟢';
      colorClass = 'text-accent-green bg-accent-green/10 border-accent-green/20';
      label = 'STRONG';
    } else if (classification === 'HEALTHY_VOLUME') {
      icon = '🟢';
      colorClass = 'text-accent-green bg-accent-green/10 border-accent-green/20';
      label = 'HEALTHY';
    } else if (classification === 'WEAK_VOLUME') {
      icon = '🟠';
      colorClass = 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      label = 'WEAK';
    } else if (classification === 'INSTITUTIONAL_DISTRIBUTION') {
      icon = '🔴';
      colorClass = 'text-accent-red bg-accent-red/10 border-accent-red/20';
      label = 'DISTRIBUTION';
    }

    const formatVol = (v: number) => {
      if (v >= 1000000) return (v / 1000000).toFixed(2) + 'M';
      if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
      return v.toString();
    };

    return (
      <div className="group/vol relative inline-flex items-center cursor-help">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase ${colorClass}`}>
          <span>{icon}</span>
          <span>{label}</span>
        </span>
        <div className="opacity-0 group-hover/vol:opacity-100 transition-opacity absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-max max-w-[200px] p-3 bg-bg-tertiary border border-border-custom rounded-lg shadow-xl text-left z-50 pointer-events-none">
          <p className="text-xs font-bold text-text-primary mb-1">Institutional Volume</p>
          <div className="text-[11px] text-text-secondary flex flex-col gap-0.5">
            <span className="flex justify-between w-36"><span>RVOL:</span> <span className="text-text-primary font-medium">{rvol}x</span></span>
            <span className="flex justify-between w-36"><span>Current Vol:</span> <span className="text-text-primary font-medium">{formatVol(currentVol)}</span></span>
            <span className="flex justify-between w-36"><span>20D Avg:</span> <span className="text-text-primary font-medium">{formatVol(avgVol20)}</span></span>
            <span className="flex justify-between w-36"><span>Class:</span> <span className={`${colorClass.split(' ')[0]} font-medium`}>{classification.replace('_', ' ')}</span></span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg-primary pt-16">
      <PageCover />
      
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 relative z-10 -mt-16">
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-2 flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-accent-blue" />
              Market Scanner
            </h1>
            <p className="text-text-secondary flex items-center gap-2">
              Scanner ranks market setups by pattern quality, breakout status, confidence, and risk/reward.
              <span className="text-xs font-semibold px-2 py-0.5 bg-accent-blue/10 text-accent-blue rounded-full border border-accent-blue/20">
                Scanning {limit} stocks
              </span>
            </p>
            {metrics && (metrics.usRegime || metrics.indiaRegime) && (
              <div className="flex flex-wrap gap-3 mt-4">
                {renderRegimeBadge('US', metrics.usRegime)}
                {renderRegimeBadge('INDIA', metrics.indiaRegime)}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
            <div className="flex bg-bg-secondary p-1 rounded-lg border border-border-custom">
              <button
                onClick={() => setLimit(10)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${limit === 10 ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
              >
                10 Stocks
              </button>
              <button
                onClick={() => setLimit(30)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${limit === 30 ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
              >
                30 Stocks
              </button>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-bg-card hover:bg-bg-card-hover border border-border-custom rounded-lg text-sm font-medium text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-accent-red/10 border border-accent-red/20 rounded-xl flex items-center gap-3 text-accent-red">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {metrics?.topSectors && metrics.topSectors.length > 0 && (
          <div className="mb-6 p-4 bg-bg-card border border-border-custom rounded-xl flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex-shrink-0">Top Sectors</h2>
            <div className="flex flex-wrap items-center gap-2">
              {metrics.topSectors.map((sec: any, index: number) => {
                let icon = '🟡';
                if (sec.classification === 'VERY_STRONG') icon = '🔥';
                else if (sec.classification === 'STRONG') icon = '🟢';
                else if (sec.classification === 'WEAK' || sec.classification === 'VERY_WEAK') icon = '🔴';
                return (
                  <span key={`${sec.sector}-${sec.score}-${index}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary border border-border-custom rounded-lg text-xs font-bold text-text-secondary hover:text-text-primary transition-colors cursor-default">
                    <span>{icon}</span>
                    <span>{sec.sector}</span>
                    <span className="text-text-primary ml-1">{sec.score}</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {metrics?.topLeaders && metrics.topLeaders.length > 0 && (
          <div className="mb-6 p-4 bg-bg-card border border-border-custom rounded-xl flex flex-col sm:flex-row sm:items-center gap-4">
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex-shrink-0">Market Leaders</h2>
            <div className="flex flex-wrap items-center gap-2">
              {metrics.topLeaders.map((leader: any, index: number) => (
                <span key={`${leader.ticker}-${index}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary border border-emerald-500/20 rounded-lg text-xs font-bold text-text-secondary hover:text-text-primary transition-colors cursor-default">
                  <span>🔥</span>
                  <span>{leader.ticker}</span>
                  <span className={leader.rs20 > 0 ? "text-accent-green ml-1" : "text-accent-red ml-1"}>
                    {leader.rs20 > 0 ? '+' : ''}{leader.rs20}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {metrics?.institutionalFlow && (
          <div className="mb-6 p-4 bg-bg-card border border-border-custom rounded-xl flex flex-col gap-3">
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">Institutional Flow</h2>
            <div className="flex flex-col sm:flex-row gap-6">
              {metrics.institutionalFlow.buying?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-emerald-500 w-16">🔥 Buying:</span>
                  {metrics.institutionalFlow.buying.map((ticker: string, index: number) => (
                    <span key={`buying-${ticker}-${index}`} className="inline-flex items-center px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded text-xs font-bold text-emerald-500">
                      {ticker}
                    </span>
                  ))}
                </div>
              )}
              {metrics.institutionalFlow.distribution?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-accent-red w-16">🔴 Dist:</span>
                  {metrics.institutionalFlow.distribution.map((ticker: string, index: number) => (
                    <span key={`dist-${ticker}-${index}`} className="inline-flex items-center px-2 py-1 bg-accent-red/10 border border-accent-red/20 rounded text-xs font-bold text-accent-red">
                      {ticker}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-bg-card border border-border-custom rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-secondary/50 border-b border-border-custom">
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap sticky left-0 z-20 bg-[#161b22] border-r border-border-custom">Ticker</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Sector</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap text-center">RS</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap text-center">VOL</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Pattern</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap">Breakout Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap text-center cursor-help" title="Daily / Weekly / Monthly trend alignment">MTF</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap text-right">Entry</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap text-right">Stop Loss</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap text-right">Target</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap text-right cursor-help" title="Expected reward divided by expected risk">Risk/Reward</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap text-center cursor-help" title="Score: Tradeability score after all filters | Conf: Prediction confidence after calibration">Score / Conf</th>
                  <th className="px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider whitespace-nowrap text-center sticky right-0 z-20 bg-[#161b22] border-l border-border-custom">Trade Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-custom">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4"><div className="h-4 bg-bg-secondary rounded w-16"></div></td>
                      <td className="px-4 py-4"><div className="h-4 bg-bg-secondary rounded w-24"></div></td>
                      <td className="px-4 py-4"><div className="h-6 bg-bg-secondary rounded-full w-24 mx-auto"></div></td>
                      <td className="px-4 py-4"><div className="h-6 bg-bg-secondary rounded-full w-20 mx-auto"></div></td>
                      <td className="px-4 py-4"><div className="h-6 bg-bg-secondary rounded-full w-28"></div></td>
                      <td className="px-4 py-4"><div className="h-4 bg-bg-secondary rounded w-12 ml-auto"></div></td>
                      <td className="px-4 py-4"><div className="h-4 bg-bg-secondary rounded w-12 ml-auto"></div></td>
                      <td className="px-4 py-4"><div className="h-4 bg-bg-secondary rounded w-12 ml-auto"></div></td>
                      <td className="px-4 py-4"><div className="h-4 bg-bg-secondary rounded w-10 ml-auto"></div></td>
                      <td className="px-4 py-4"><div className="h-6 bg-bg-secondary rounded-full w-12 mx-auto"></div></td>
                      <td className="px-4 py-4"><div className="h-6 bg-bg-secondary rounded-full w-20 mx-auto"></div></td>
                    </tr>
                  ))
                ) : results.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-text-secondary">
                      No results found.
                    </td>
                  </tr>
                ) : (
                  results.map((result, index) => (
                    <tr key={`${result.ticker}-${index}`} className="hover:bg-bg-secondary/30 transition-colors group">
                      <td className="px-4 py-3 font-bold text-text-primary whitespace-nowrap sticky left-0 z-10 bg-bg-card group-hover:bg-[#1a202c] border-r border-border-custom transition-colors">{result.ticker ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {renderSectorBadge(result.sector, result.sectorScore, result.sectorClassification)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {renderRSBadge(result.rsScore, result.rsClassification, result.rs20, result.rs50, result.rs100)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {renderVOLBadge(result.volClassification, result.volRvol, result.volCurrent, result.volAvg20D)}
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">{result.pattern ?? '—'}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5">
                          <span className={`inline-flex items-center justify-center w-36 py-1 rounded text-[10px] font-bold border tracking-wider uppercase ${getStatusColor(result.breakoutStatus)}`}>
                            {result.breakoutStatus.replace(/_/g, ' ')}
                          </span>
                          {result.support !== null && result.resistance !== null && (
                            <span className="hidden lg:block text-[10px] text-text-secondary">
                              S: {formatValue(result.support)} | R: {formatValue(result.resistance)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        {renderMtfBadge(result.dailyTrend, result.weeklyTrend, result.monthlyTrend, result.multiTimeframeScore)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-text-primary text-right whitespace-nowrap">{result.hasValidTradePlan && result.entry !== null ? formatValue(result.entry) : '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-accent-red text-right whitespace-nowrap">{result.hasValidTradePlan && result.stopLoss !== null ? formatValue(result.stopLoss) : '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium text-accent-green text-right whitespace-nowrap">{result.hasValidTradePlan && result.target !== null ? formatValue(result.target) : '—'}</td>
                      <td className="px-4 py-3 text-sm text-text-secondary text-right whitespace-nowrap">{result.hasValidTradePlan && result.riskReward !== null ? result.riskReward.toFixed(2) : '—'}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded text-xs font-bold ${
                            result.opportunityScore >= 70 ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20' : 
                            result.opportunityScore >= 50 ? 'bg-text-secondary/10 text-text-primary' : 
                            'bg-bg-secondary text-text-secondary'
                          }`} title={`Opportunity Score: ${result.opportunityScore}`}>
                            {result.opportunityScore}
                          </span>
                          <span className={`inline-flex items-center justify-center min-w-[3rem] px-2 py-1 rounded-lg text-xs font-bold ${
                            result.confidence >= 65 ? 'bg-accent-green/10 text-accent-green' : 
                            result.confidence >= 50 ? 'bg-accent-blue/10 text-accent-blue' : 
                            'bg-accent-red/10 text-accent-red'
                          }`} title={`Confidence: ${result.confidence.toFixed(1)}%`}>
                            {result.confidence.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap sticky right-0 z-10 bg-bg-card group-hover:bg-[#1a202c] border-l border-border-custom transition-colors">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`inline-flex items-center justify-center w-36 py-1.5 rounded-md text-[11px] font-bold tracking-wide uppercase ${getTradeTypeStyle(result.tradeType)}`}>
                            {result.tradeType.replace('_', ' ')}
                          </span>
                          {result.rejectionReasons?.length > 0 && (
                            <div className="group/tooltip relative flex items-center">
                              <Info size={14} className="text-text-secondary hover:text-text-primary cursor-help transition-colors" />
                              <div className="opacity-0 group-hover/tooltip:opacity-100 transition-opacity absolute right-full mr-2 top-1/2 -translate-y-1/2 w-max max-w-[200px] p-3 bg-bg-tertiary border border-border-custom rounded-lg shadow-xl text-left z-50 pointer-events-none">
                                <p className="text-xs font-bold text-text-primary mb-1.5">Reasons/Info:</p>
                                <ul className="text-[11px] text-text-secondary flex flex-col gap-1">
                                  {result.rejectionReasons.map((r, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                      <span className="text-accent-red mt-0.5">•</span>
                                      <span className="whitespace-normal leading-tight">{r}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
