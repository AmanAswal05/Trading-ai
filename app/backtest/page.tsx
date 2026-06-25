/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SP500_UNIVERSE, getAllSectors, getTickersBySector } from '../../lib/backtesting/stock-universe';
import { BacktestTimeframe, ProfessionalReport } from '../../lib/backtesting/types';
import ResultsDashboard from '../../components/backtest/ResultsDashboard';

interface JobProgress {
  status: string;
  progress: number;
  phase: string;
  currentTicker?: string;
  totalTickers: number;
  completedTickers: number;
}

export default function BacktestLabPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'results'>('config');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [report, setReport] = useState<ProfessionalReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [timeframe, setTimeframe] = useState<BacktestTimeframe>('5Y');
  const [dataSource, setDataSource] = useState<'AUTO' | 'STOOQ' | 'YAHOO' | 'ALPHA_VANTAGE'>('AUTO');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tickerMode, setTickerMode] = useState<'SINGLE' | 'MULTIPLE' | 'SECTOR' | 'MARKET'>('SINGLE');
  const [selectedTickers, setSelectedTickers] = useState<string[]>(['AAPL']);
  const [selectedSector, setSelectedSector] = useState<string>('Information Technology');
  const [tickerInput, setTickerInput] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>(['V1']);
  
  // Risk & Sizing
  const [initialCapital, setInitialCapital] = useState(10000);
  const [positionSizing, setPositionSizing] = useState(100);
  const [stopLoss, setStopLoss] = useState(5);
  const [takeProfit, setTakeProfit] = useState(10);
  const [confidenceFilter, setConfidenceFilter] = useState(50);
  const [signalStrengthFilter, setSignalStrengthFilter] = useState<'ALL' | 'MODERATE_STRONG' | 'STRONG_ONLY'>('ALL');
  const [maxTrades, setMaxTrades] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);

  const effectiveTickers = useCallback(() => {
    if (tickerMode === 'SINGLE') return selectedTickers.slice(0, 1);
    if (tickerMode === 'MULTIPLE') return selectedTickers;
    if (tickerMode === 'SECTOR') return getTickersBySector(selectedSector).map(s => s.ticker).slice(0, 20);
    if (tickerMode === 'MARKET') return SP500_UNIVERSE.slice(0, 30).map(s => s.ticker);
    return selectedTickers;
  }, [tickerMode, selectedTickers, selectedSector]);

  const launchBacktest = async () => {
    setError(null);
    setIsRunning(true);
    setReport(null);
    setProgress(null);

    const tickers = effectiveTickers();
    if (tickers.length === 0) {
      setError('Please select at least one ticker');
      setIsRunning(false);
      return;
    }

    try {
      const payload = {
        name: `Backtest ${timeframe} — ${tickers.slice(0, 3).join(', ')}${tickers.length > 3 ? '...' : ''}`,
        timeframe,
        dataSource,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        models: selectedModels,
        tickerMode,
        tickers,
        sector: selectedSector,
        initialCapital,
        positionSizing,
        stopLoss,
        takeProfit,
        confidenceFilter,
        signalStrengthFilter,
        maxTrades,
      };

      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to start backtest'); setIsRunning(false); return; }

      setJobId(data.jobId);
      setActiveTab('results');
      startPolling(data.jobId);
    } catch (e: any) {
      setError(e.message);
      setIsRunning(false);
    }
  };

  const startPolling = (jid: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const es = new EventSource(`/api/backtest/status/${jid}`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'progress') {
        setProgress({
          status: data.status,
          progress: data.progress,
          phase: data.phase,
          currentTicker: data.currentTicker,
          totalTickers: data.totalTickers,
          completedTickers: data.completedTickers,
        });
      }
      if (data.type === 'done') {
        es.close();
        if (data.status === 'COMPLETED') fetchResults(jid);
        else { setIsRunning(false); setError('Backtest failed. Check server logs.'); }
      }
    };
    es.onerror = () => { es.close(); setIsRunning(false); };
  };

  const fetchResults = async (jid: string) => {
    try {
      const res = await fetch(`/api/backtest/results/${jid}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => () => { eventSourceRef.current?.close(); }, []);

  const toggleTicker = (t: string) => {
    setSelectedTickers(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const addTickerInput = () => {
    const upper = tickerInput.toUpperCase().trim();
    if (upper && !selectedTickers.includes(upper)) {
      setSelectedTickers(prev => [...prev, upper]);
    }
    setTickerInput('');
  };

  return (
    <div className="backtest-lab">
      <div className="lab-header">
        <div className="lab-header-inner">
          <div className="lab-badge">⚗️ Institutional</div>
          <h1 className="lab-title">Backtesting Lab</h1>
          <p className="lab-subtitle">Test algorithms with realistic constraints using multiple market data sources.</p>
        </div>
        <div className="lab-tabs">
          <button className={`lab-tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>⚙️ Configure</button>
          <button className={`lab-tab ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')} disabled={!report && !isRunning}>📊 Results {report ? '' : isRunning ? '(Running...)' : ''}</button>
        </div>
      </div>

      {activeTab === 'config' && (
        <div className="lab-content">
          <div className="lab-main">
            {/* Time & Data Source */}
            <div className="config-section">
              <div className="config-section-header">
                <h2>Timeframe & Data Source</h2>
              </div>
              <div className="field-group">
                <label className="field-label">Historical Timeframe</label>
                <div className="pill-grid">
                  {(['1D','7D','30D','90D','365D','1Y','3Y','5Y','10Y'] as BacktestTimeframe[]).map(tf => (
                    <button key={tf} className={`pill ${timeframe === tf && !startDate ? 'active' : ''}`} onClick={() => {setTimeframe(tf); setStartDate(''); setEndDate('');}}>{tf}</button>
                  ))}
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Data Source</label>
                <div className="pill-grid mode-grid">
                  {(['AUTO','STOOQ','YAHOO','ALPHA_VANTAGE'] as const).map(ds => (
                    <button key={ds} className={`pill ${dataSource === ds ? 'active' : ''}`} onClick={() => setDataSource(ds)}>{ds.replace('_', ' ')}</button>
                  ))}
                </div>
              </div>
              <div className="field-group custom-dates">
                <label className="field-label">Or Custom Date Range</label>
                <div style={{display: 'flex', gap: '10px'}}>
                  <input type="date" className="ticker-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  <input type="date" className="ticker-input" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Asset Selection */}
            <div className="config-section">
              <div className="config-section-header">
                <h2>Asset Selection</h2>
              </div>
              <div className="field-group">
                <div className="pill-grid mode-grid">
                  {(['SINGLE','MULTIPLE','SECTOR','MARKET'] as const).map(m => (
                    <button key={m} className={`pill ${tickerMode === m ? 'active' : ''}`} onClick={() => setTickerMode(m)}>{m}</button>
                  ))}
                </div>
              </div>
              {(tickerMode === 'SINGLE' || tickerMode === 'MULTIPLE') && (
                <>
                  <div className="ticker-search">
                    <input value={tickerInput} onChange={e => setTickerInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && addTickerInput()} placeholder="Type ticker + Enter (e.g. AAPL)" className="ticker-input" />
                    <button onClick={addTickerInput} className="btn-add">Add</button>
                  </div>
                  {selectedTickers.length > 0 && (
                    <div className="selected-tickers">
                      <div className="ticker-grid">
                        {selectedTickers.map(t => (
                          <button key={t} className="ticker-chip selected removable" onClick={() => toggleTicker(t)}>{t} ✕</button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Trading Strategy / Risk */}
            <div className="config-section">
              <div className="config-section-header">
                <h2>Trading Strategy & Risk Management</h2>
              </div>
              <div className="wf-grid">
                <div className="wf-field">
                  <label className="field-label">Initial Capital ($)</label>
                  <input type="number" className="ticker-input" value={initialCapital} onChange={e => setInitialCapital(Number(e.target.value))} />
                </div>
                <div className="wf-field">
                  <label className="field-label">Position Sizing (%)</label>
                  <input type="number" className="ticker-input" value={positionSizing} onChange={e => setPositionSizing(Number(e.target.value))} />
                </div>
                <div className="wf-field">
                  <label className="field-label">Stop Loss (%)</label>
                  <input type="number" className="ticker-input" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} />
                </div>
                <div className="wf-field">
                  <label className="field-label">Take Profit (%)</label>
                  <input type="number" className="ticker-input" value={takeProfit} onChange={e => setTakeProfit(Number(e.target.value))} />
                </div>
                <div className="wf-field">
                  <label className="field-label">Min Confidence (%)</label>
                  <input type="number" className="ticker-input" value={confidenceFilter} onChange={e => setConfidenceFilter(Number(e.target.value))} />
                </div>
                <div className="wf-field">
                  <label className="field-label">Max Trades (0 = ∞)</label>
                  <input type="number" className="ticker-input" value={maxTrades} onChange={e => setMaxTrades(Number(e.target.value))} />
                </div>
                <div className="wf-field">
                  <label className="field-label">Signal Filter</label>
                  <select className="ticker-input" value={signalStrengthFilter} onChange={e => setSignalStrengthFilter(e.target.value as any)}>
                    <option value="ALL">All Signals</option>
                    <option value="MODERATE_STRONG">Moderate & Strong Only</option>
                    <option value="STRONG_ONLY">Strong Only</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="lab-sidebar">
            <div className="launch-card">
              <h3 className="launch-title">Backtest Summary</h3>
              <div className="launch-rows">
                <div className="launch-row"><span>Timeframe</span><strong>{startDate ? 'Custom' : timeframe}</strong></div>
                <div className="launch-row"><span>Stocks</span><strong>{effectiveTickers().length}</strong></div>
                <div className="launch-row"><span>Capital</span><strong>${initialCapital.toLocaleString()}</strong></div>
              </div>
              {error && <div className="error-box">{error}</div>}
              <button className="launch-btn" onClick={launchBacktest} disabled={isRunning}>
                {isRunning ? '⚙️ Running...' : '🚀 Launch Backtest'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="results-view">
          {isRunning && progress && (
            <div className="progress-container">
              <div className="progress-header">
                <div className="progress-phase">⚙️ {progress.phase}</div>
                {progress.currentTicker && <div className="progress-ticker">Processing: <strong>{progress.currentTicker}</strong></div>}
                <div className="progress-pct">{progress.progress}%</div>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progress.progress}%` }} />
              </div>
            </div>
          )}
          {report && <ResultsDashboard report={report} jobId={jobId!} />}
        </div>
      )}

      <style>{`
        .backtest-lab { min-height: 100vh; background: #070810; color: #e2e8f0; }
        .lab-header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-bottom: 1px solid #1e3a5f; padding: 40px 32px 0; }
        .lab-header-inner { max-width: 1400px; margin: 0 auto; }
        .lab-badge { display: inline-block; background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); padding: 4px 12px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; margin-bottom: 12px; }
        .lab-title { font-size: 2.5rem; font-weight: 900; background: linear-gradient(135deg, #f8fafc, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
        .lab-subtitle { color: #64748b; font-size: 1rem; margin-bottom: 24px; }
        .lab-tabs { display: flex; gap: 4px; max-width: 1400px; margin: 0 auto; }
        .lab-tab { padding: 12px 24px; border: none; background: transparent; color: #64748b; font-size: 0.9rem; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .lab-tab.active { color: #38bdf8; border-bottom-color: #38bdf8; }
        .lab-content { display: grid; grid-template-columns: 1fr 340px; gap: 24px; max-width: 1400px; margin: 0 auto; padding: 32px; }
        .lab-main { display: flex; flex-direction: column; gap: 20px; }
        .config-section { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 16px; padding: 24px; }
        .config-section-header { margin-bottom: 20px; }
        .config-section-header h2 { font-size: 1.1rem; font-weight: 700; color: #f1f5f9; }
        .field-group { margin-bottom: 16px; }
        .field-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 10px; }
        .pill-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .pill { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 6px 14px; border-radius: 99px; font-size: 0.8rem; cursor: pointer; }
        .pill.active { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        .ticker-search { display: flex; gap: 8px; margin-bottom: 16px; }
        .ticker-input { flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; color: #f1f5f9; width: 100%; box-sizing: border-box; outline: none; }
        .btn-add { background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
        .ticker-grid { display: flex; flex-wrap: wrap; gap: 6px; }
        .ticker-chip { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; }
        .ticker-chip.selected { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        .wf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .wf-field { }
        .lab-sidebar { display: flex; flex-direction: column; gap: 20px; }
        .launch-card { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 16px; padding: 24px; position: sticky; top: 24px; }
        .launch-title { font-size: 1rem; font-weight: 700; color: #f1f5f9; margin-bottom: 16px; }
        .launch-rows { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
        .launch-row { display: flex; justify-content: space-between; font-size: 0.85rem; color: #64748b; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }
        .launch-row strong { color: #e2e8f0; }
        .launch-btn { width: 100%; background: linear-gradient(135deg, #6366f1, #38bdf8); border: none; border-radius: 12px; padding: 14px; color: white; font-size: 1rem; font-weight: 700; cursor: pointer; }
        .launch-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .error-box { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); border-radius: 8px; padding: 10px 12px; color: #f87171; font-size: 0.85rem; margin-bottom: 12px; }
        .results-view { max-width: 1400px; margin: 0 auto; padding: 32px; }
        .progress-container { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 16px; padding: 24px; margin-bottom: 24px; }
        .progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .progress-phase { font-size: 0.9rem; font-weight: 600; color: #38bdf8; }
        .progress-pct { font-size: 1.2rem; font-weight: 800; color: #38bdf8; }
        .progress-bar-track { background: #1e293b; border-radius: 99px; height: 8px; overflow: hidden; }
        .progress-bar-fill { background: linear-gradient(90deg, #6366f1, #38bdf8); height: 100%; border-radius: 99px; transition: width 0.5s ease; }
      `}</style>
    </div>
  );
}
