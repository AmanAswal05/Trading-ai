'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SP500_UNIVERSE, getAllSectors, getTickersBySector } from '../../lib/backtesting/stock-universe';
import { STRESS_SCENARIOS } from '../../lib/backtesting/stress-scenarios';
import { BacktestConfig, BacktestTimeframe, ProfessionalReport } from '../../lib/backtesting/types';
import ResultsDashboard from '../../components/backtest/ResultsDashboard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JobProgress {
  status: string;
  progress: number;
  phase: string;
  currentTicker?: string;
  totalTickers: number;
  completedTickers: number;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BacktestLabPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'results'>('config');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [report, setReport] = useState<ProfessionalReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [timeframe, setTimeframe] = useState<BacktestTimeframe>('5Y');
  const [tickerMode, setTickerMode] = useState<'SINGLE' | 'MULTIPLE' | 'SECTOR' | 'MARKET'>('MULTIPLE');
  const [selectedTickers, setSelectedTickers] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA']);
  const [selectedSector, setSelectedSector] = useState<string>('Information Technology');
  const [tickerInput, setTickerInput] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>(['V1', 'V2', 'META']);
  const [horizon, setHorizon] = useState<'1D' | '7D' | '30D' | '90D'>('7D');
  const [walkForward, setWalkForward] = useState(false);
  const [trainYears, setTrainYears] = useState(5);
  const [validateMonths, setValidateMonths] = useState(12);
  const [testMonths, setTestMonths] = useState(12);
  const [stepMonths, setStepMonths] = useState(12);
  const [monteCarloEnabled, setMonteCarloEnabled] = useState(false);
  const [simCount, setSimCount] = useState<number>(100000);
  const [stressEnabled, setStressEnabled] = useState(false);
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>(['DOT_COM_CRASH', 'FINANCIAL_CRISIS_2008', 'COVID_CRASH']);

  const eventSourceRef = useRef<EventSource | null>(null);

  // ─── Get effective tickers ─────────────────────────────────────────────────
  const effectiveTickers = useCallback(() => {
    if (tickerMode === 'SINGLE') return selectedTickers.slice(0, 1);
    if (tickerMode === 'MULTIPLE') return selectedTickers;
    if (tickerMode === 'SECTOR') return getTickersBySector(selectedSector).map(s => s.ticker).slice(0, 20);
    if (tickerMode === 'MARKET') return SP500_UNIVERSE.slice(0, 30).map(s => s.ticker); // Cap for demo
    return selectedTickers;
  }, [tickerMode, selectedTickers, selectedSector]);

  // ─── Launch Backtest ───────────────────────────────────────────────────────
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
      const res = await fetch('/api/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Backtest ${timeframe} — ${tickers.slice(0, 3).join(', ')}${tickers.length > 3 ? '...' : ''}`,
          timeframe,
          models: selectedModels,
          tickerMode,
          tickers,
          sector: selectedSector,
          predictionHorizon: horizon,
          walkForward,
          walkForwardConfig: walkForward ? { trainYears, validateMonths, testMonths, stepMonths } : undefined,
          monteCarloEnabled,
          monteCarloConfig: monteCarloEnabled ? { simCount, horizon: 252 } : undefined,
          stressTestEnabled: stressEnabled,
          stressScenarios: stressEnabled ? selectedScenarios : undefined,
        }),
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

  const toggleModel = (m: string) => {
    setSelectedModels(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const toggleScenario = (s: string) => {
    setSelectedScenarios(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const sectors = getAllSectors();
  const popularTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM', 'JNJ', 'XOM', 'WMT', 'BAC', 'V', 'MA', 'UNH'];
  const models = [
    { id: 'V1', name: 'Current Model', desc: 'Baseline prediction engine' },
    { id: 'V2', name: 'Adaptive Weights', desc: 'Self-adjusting indicator weights' },
    { id: 'V3', name: 'Trend Regime', desc: 'Long-term trend focused' },
    { id: 'REGIME', name: 'Regime Detection', desc: 'Market state classifier' },
    { id: 'META', name: 'Meta Ensemble', desc: 'All sub-engines combined' },
  ];

  return (
    <div className="backtest-lab">
      {/* ── Header ── */}
      <div className="lab-header">
        <div className="lab-header-inner">
          <div className="lab-badge">⚗️ Institutional</div>
          <h1 className="lab-title">Backtesting Lab</h1>
          <p className="lab-subtitle">Stress-test the prediction engine across decades of market data with large-scale simulations</p>
        </div>

        {/* ── Tabs ── */}
        <div className="lab-tabs">
          <button className={`lab-tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
            ⚙️ Configure
          </button>
          <button className={`lab-tab ${activeTab === 'results' ? 'active' : ''}`} onClick={() => setActiveTab('results')} disabled={!report && !isRunning}>
            📊 Results {report ? '' : isRunning ? '(Running...)' : ''}
          </button>
        </div>
      </div>

      {activeTab === 'config' && (
        <div className="lab-content">
          {/* ── Left Column: Config ── */}
          <div className="lab-main">

            {/* Phase 1: Timeframe */}
            <div className="config-section">
              <div className="config-section-header">
                <span className="phase-badge">Phase 1</span>
                <h2>Long-Horizon Backtesting</h2>
              </div>
              <div className="field-group">
                <label className="field-label">Historical Timeframe</label>
                <div className="pill-grid">
                  {(['1Y','3Y','5Y','10Y','20Y','30Y','40Y','50Y'] as BacktestTimeframe[]).map(tf => (
                    <button key={tf} className={`pill ${timeframe === tf ? 'active' : ''}`} onClick={() => setTimeframe(tf)}>{tf}</button>
                  ))}
                </div>
              </div>
              <div className="field-group">
                <label className="field-label">Prediction Horizon</label>
                <div className="pill-grid">
                  {(['1D','7D','30D','90D'] as const).map(h => (
                    <button key={h} className={`pill ${horizon === h ? 'active' : ''}`} onClick={() => setHorizon(h)}>{h}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stock Selection */}
            <div className="config-section">
              <div className="config-section-header">
                <span className="phase-badge">Selection</span>
                <h2>Stock Universe</h2>
              </div>
              <div className="field-group">
                <div className="pill-grid mode-grid">
                  {(['SINGLE','MULTIPLE','SECTOR','MARKET'] as const).map(m => (
                    <button key={m} className={`pill ${tickerMode === m ? 'active' : ''}`} onClick={() => setTickerMode(m)}>
                      {m === 'SINGLE' ? '📌 Single' : m === 'MULTIPLE' ? '📋 Multiple' : m === 'SECTOR' ? '🏭 Sector' : '🌐 Market'}
                    </button>
                  ))}
                </div>
              </div>

              {(tickerMode === 'SINGLE' || tickerMode === 'MULTIPLE') && (
                <>
                  <div className="ticker-search">
                    <input
                      value={tickerInput}
                      onChange={e => setTickerInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && addTickerInput()}
                      placeholder="Type ticker + Enter (e.g. AAPL)"
                      className="ticker-input"
                    />
                    <button onClick={addTickerInput} className="btn-add">Add</button>
                  </div>
                  <div className="field-label" style={{marginBottom:'8px'}}>Quick Select</div>
                  <div className="ticker-grid">
                    {popularTickers.map(t => (
                      <button key={t}
                        className={`ticker-chip ${selectedTickers.includes(t) ? 'selected' : ''}`}
                        onClick={() => toggleTicker(t)}
                      >{t}</button>
                    ))}
                  </div>
                  {selectedTickers.length > 0 && (
                    <div className="selected-tickers">
                      <div className="field-label" style={{marginBottom:'6px'}}>Selected ({selectedTickers.length})</div>
                      <div className="ticker-grid">
                        {selectedTickers.map(t => (
                          <button key={t} className="ticker-chip selected removable" onClick={() => toggleTicker(t)}>{t} ✕</button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {tickerMode === 'SECTOR' && (
                <div className="field-group">
                  <label className="field-label">Select Sector</label>
                  <div className="pill-grid">
                    {sectors.map(s => (
                      <button key={s} className={`pill ${selectedSector === s ? 'active' : ''}`} onClick={() => setSelectedSector(s)} style={{fontSize:'0.75rem'}}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tickerMode === 'MARKET' && (
                <div className="market-notice">
                  🌐 Will backtest the top 30 S&P 500 stocks across all sectors. Long-running process.
                </div>
              )}
            </div>

            {/* Phase 7: Model Selection */}
            <div className="config-section">
              <div className="config-section-header">
                <span className="phase-badge">Phase 7</span>
                <h2>Model Comparison</h2>
              </div>
              <div className="model-grid">
                {models.map(m => (
                  <button key={m.id}
                    className={`model-card ${selectedModels.includes(m.id) ? 'selected' : ''}`}
                    onClick={() => toggleModel(m.id)}
                  >
                    <div className="model-name">{m.name}</div>
                    <div className="model-desc">{m.desc}</div>
                    {selectedModels.includes(m.id) && <div className="model-check">✓</div>}
                  </button>
                ))}
              </div>
            </div>

            {/* Phase 2: Walk-Forward */}
            <div className="config-section">
              <div className="config-section-header">
                <span className="phase-badge">Phase 2</span>
                <h2>Walk-Forward Testing</h2>
                <label className="toggle-switch">
                  <input type="checkbox" checked={walkForward} onChange={e => setWalkForward(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              {walkForward && (
                <div className="wf-grid">
                  {[
                    { label: 'Train Period (years)', value: trainYears, set: setTrainYears, min: 1, max: 20 },
                    { label: 'Validate Period (months)', value: validateMonths, set: setValidateMonths, min: 3, max: 36 },
                    { label: 'Test Period (months)', value: testMonths, set: setTestMonths, min: 3, max: 24 },
                    { label: 'Step Size (months)', value: stepMonths, set: setStepMonths, min: 1, max: 24 },
                  ].map(({ label, value, set, min, max }) => (
                    <div key={label} className="wf-field">
                      <label className="field-label">{label}</label>
                      <div className="range-row">
                        <input type="range" min={min} max={max} value={value} onChange={e => set(Number(e.target.value))} className="range-input" />
                        <span className="range-value">{value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Phase 3: Monte Carlo */}
            <div className="config-section">
              <div className="config-section-header">
                <span className="phase-badge">Phase 3</span>
                <h2>Monte Carlo Simulation</h2>
                <label className="toggle-switch">
                  <input type="checkbox" checked={monteCarloEnabled} onChange={e => setMonteCarloEnabled(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              {monteCarloEnabled && (
                <div className="field-group">
                  <label className="field-label">Simulation Count</label>
                  <div className="pill-grid">
                    {[100000, 250000, 500000, 1000000].map(n => (
                      <button key={n} className={`pill ${simCount === n ? 'active' : ''}`} onClick={() => setSimCount(n)}>
                        {n >= 1000000 ? '1M' : n >= 250000 ? '250K' : n >= 100000 ? '100K' : n >= 50000 ? '50K' : '10K'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Phase 4: Stress Tests */}
            <div className="config-section">
              <div className="config-section-header">
                <span className="phase-badge">Phase 4</span>
                <h2>Stress Testing</h2>
                <label className="toggle-switch">
                  <input type="checkbox" checked={stressEnabled} onChange={e => setStressEnabled(e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
              </div>
              {stressEnabled && (
                <div className="scenario-grid">
                  {Object.values(STRESS_SCENARIOS).map(s => (
                    <button
                      key={s.key}
                      className={`scenario-card ${selectedScenarios.includes(s.key) ? 'selected' : ''}`}
                      onClick={() => toggleScenario(s.key)}
                    >
                      <div className="scenario-name">{s.name}</div>
                      <div className="scenario-return" style={{ color: '#f87171' }}>S&P: {s.historicalSPReturn}%</div>
                      {selectedScenarios.includes(s.key) && <div className="scenario-check">✓</div>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Sidebar: Summary + Launch ── */}
          <div className="lab-sidebar">
            <div className="launch-card">
              <h3 className="launch-title">Backtest Summary</h3>
              <div className="launch-rows">
                <div className="launch-row"><span>Timeframe</span><strong>{timeframe}</strong></div>
                <div className="launch-row"><span>Horizon</span><strong>{horizon}</strong></div>
                <div className="launch-row"><span>Stocks</span><strong>{effectiveTickers().length}</strong></div>
                <div className="launch-row"><span>Models</span><strong>{selectedModels.length}</strong></div>
                <div className="launch-row"><span>Walk-Forward</span><strong>{walkForward ? '✓' : '—'}</strong></div>
                <div className="launch-row"><span>Monte Carlo</span><strong>{monteCarloEnabled ? simCount.toLocaleString() + ' sims' : '—'}</strong></div>
                <div className="launch-row"><span>Stress Tests</span><strong>{stressEnabled ? selectedScenarios.length + ' scenarios' : '—'}</strong></div>
              </div>

              {error && <div className="error-box">{error}</div>}

              <button className="launch-btn" onClick={launchBacktest} disabled={isRunning}>
                {isRunning ? '⚙️ Running...' : '🚀 Launch Backtest'}
              </button>
            </div>

            {/* Performance Targets */}
            <div className="targets-card">
              <h3 className="targets-title">⚡ Engine Specs</h3>
              <div className="target-row">
                <div className="target-icon">🖥️</div>
                <div>
                  <div className="target-name">Apple Silicon Optimized</div>
                  <div className="target-desc">All CPU cores utilized</div>
                </div>
              </div>
              <div className="target-row">
                <div className="target-icon">🗄️</div>
                <div>
                  <div className="target-name">SQLite Cache</div>
                  <div className="target-desc">Millions of OHLCV bars stored locally</div>
                </div>
              </div>
              <div className="target-row">
                <div className="target-icon">📡</div>
                <div>
                  <div className="target-name">Real-Time Progress</div>
                  <div className="target-desc">Live streaming via SSE</div>
                </div>
              </div>
              <div className="target-row">
                <div className="target-icon">✅</div>
                <div>
                  <div className="target-name">Verified Results Only</div>
                  <div className="target-desc">No synthetic or fake data</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="results-view">
          {/* Progress Tracker */}
          {isRunning && progress && (
            <div className="progress-container">
              <div className="progress-header">
                <div className="progress-phase">⚙️ {progress.phase}</div>
                {progress.currentTicker && (
                  <div className="progress-ticker">Processing: <strong>{progress.currentTicker}</strong></div>
                )}
                <div className="progress-pct">{progress.progress}%</div>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progress.progress}%` }} />
              </div>
              <div className="progress-stats">
                {progress.completedTickers} / {progress.totalTickers} stocks completed
              </div>
            </div>
          )}

          {isRunning && !progress && (
            <div className="progress-container">
              <div className="progress-phase">⏳ Initializing backtest engine...</div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: '5%' }} />
              </div>
            </div>
          )}

          {/* Results Dashboard */}
          {report && <ResultsDashboard report={report} jobId={jobId!} />}

          {!isRunning && !report && (
            <div className="empty-results">
              <div className="empty-icon">📊</div>
              <h3>No results yet</h3>
              <p>Configure and launch a backtest to see results here.</p>
              <button className="btn-secondary" onClick={() => setActiveTab('config')}>Go to Config</button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .backtest-lab { min-height: 100vh; background: #070810; color: #e2e8f0; }

        .lab-header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-bottom: 1px solid #1e3a5f; padding: 40px 32px 0; }
        .lab-header-inner { max-width: 1400px; margin: 0 auto; }
        .lab-badge { display: inline-block; background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); padding: 4px 12px; border-radius: 99px; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.05em; margin-bottom: 12px; }
        .lab-title { font-size: 2.5rem; font-weight: 900; background: linear-gradient(135deg, #f8fafc, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 8px; }
        .lab-subtitle { color: #64748b; font-size: 1rem; margin-bottom: 24px; }

        .lab-tabs { display: flex; gap: 4px; max-width: 1400px; margin: 0 auto; }
        .lab-tab { padding: 12px 24px; border: none; background: transparent; color: #64748b; font-size: 0.9rem; font-weight: 500; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .lab-tab:hover { color: #e2e8f0; }
        .lab-tab.active { color: #38bdf8; border-bottom-color: #38bdf8; }
        .lab-tab:disabled { opacity: 0.4; cursor: not-allowed; }

        .lab-content { display: grid; grid-template-columns: 1fr 340px; gap: 24px; max-width: 1400px; margin: 0 auto; padding: 32px; }
        .lab-main { display: flex; flex-direction: column; gap: 20px; }

        .config-section { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 16px; padding: 24px; }
        .config-section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .config-section-header h2 { font-size: 1rem; font-weight: 700; color: #f1f5f9; flex: 1; }
        .phase-badge { background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.3); padding: 2px 8px; border-radius: 99px; font-size: 0.7rem; font-weight: 700; white-space: nowrap; }

        .field-group { margin-bottom: 16px; }
        .field-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; display: block; margin-bottom: 10px; }

        .pill-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .pill { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 6px 14px; border-radius: 99px; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.15s; }
        .pill:hover { border-color: #38bdf8; color: #38bdf8; }
        .pill.active { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        .mode-grid .pill { padding: 8px 16px; }

        .ticker-search { display: flex; gap: 8px; margin-bottom: 16px; }
        .ticker-input { flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; color: #f1f5f9; font-size: 0.9rem; outline: none; }
        .ticker-input:focus { border-color: #38bdf8; }
        .btn-add { background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; padding: 10px 16px; font-weight: 700; cursor: pointer; }

        .ticker-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .ticker-chip { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: monospace; }
        .ticker-chip:hover { border-color: #38bdf8; color: #38bdf8; }
        .ticker-chip.selected { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        .ticker-chip.removable { background: rgba(56,189,248,0.1); }

        .selected-tickers { margin-top: 12px; padding-top: 12px; border-top: 1px solid #1e293b; }
        .market-notice { background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); border-radius: 10px; padding: 12px 16px; color: #fbbf24; font-size: 0.85rem; }

        .model-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
        .model-card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px; cursor: pointer; transition: all 0.2s; text-align: left; position: relative; }
        .model-card:hover { border-color: #6366f1; }
        .model-card.selected { background: rgba(99,102,241,0.1); border-color: #6366f1; }
        .model-name { font-size: 0.85rem; font-weight: 700; color: #f1f5f9; margin-bottom: 4px; }
        .model-desc { font-size: 0.75rem; color: #64748b; }
        .model-check { position: absolute; top: 10px; right: 10px; color: #6366f1; font-weight: 700; font-size: 0.9rem; }

        .wf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .wf-field { }
        .range-row { display: flex; align-items: center; gap: 10px; }
        .range-input { flex: 1; accent-color: #38bdf8; }
        .range-value { font-size: 0.9rem; font-weight: 700; color: #38bdf8; min-width: 28px; text-align: right; }

        .scenario-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
        .scenario-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px; cursor: pointer; transition: all 0.2s; text-align: left; position: relative; }
        .scenario-card:hover { border-color: #f87171; }
        .scenario-card.selected { background: rgba(248,113,113,0.08); border-color: #f87171; }
        .scenario-name { font-size: 0.8rem; font-weight: 700; color: #f1f5f9; margin-bottom: 6px; }
        .scenario-return { font-size: 0.75rem; font-weight: 600; }
        .scenario-check { position: absolute; top: 10px; right: 10px; color: #f87171; font-weight: 700; }

        /* Sidebar */
        .lab-sidebar { display: flex; flex-direction: column; gap: 20px; }
        .launch-card { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 16px; padding: 24px; position: sticky; top: 24px; }
        .launch-title { font-size: 1rem; font-weight: 700; color: #f1f5f9; margin-bottom: 16px; }
        .launch-rows { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
        .launch-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #64748b; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }
        .launch-row strong { color: #e2e8f0; }
        .launch-btn { width: 100%; background: linear-gradient(135deg, #6366f1, #38bdf8); border: none; border-radius: 12px; padding: 14px; color: white; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
        .launch-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 32px rgba(99,102,241,0.4); }
        .launch-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .error-box { background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); border-radius: 8px; padding: 10px 12px; color: #f87171; font-size: 0.85rem; margin-bottom: 12px; }

        .targets-card { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 16px; padding: 20px; }
        .targets-title { font-size: 0.9rem; font-weight: 700; color: #f1f5f9; margin-bottom: 16px; }
        .target-row { display: flex; gap: 12px; margin-bottom: 14px; align-items: flex-start; }
        .target-icon { font-size: 1.2rem; }
        .target-name { font-size: 0.85rem; font-weight: 600; color: #e2e8f0; }
        .target-desc { font-size: 0.75rem; color: #64748b; }

        /* Results */
        .results-view { max-width: 1400px; margin: 0 auto; padding: 32px; }
        .progress-container { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 16px; padding: 24px; margin-bottom: 24px; }
        .progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .progress-phase { font-size: 0.9rem; font-weight: 600; color: #38bdf8; }
        .progress-ticker { font-size: 0.85rem; color: #94a3b8; }
        .progress-pct { font-size: 1.2rem; font-weight: 800; color: #38bdf8; }
        .progress-bar-track { background: #1e293b; border-radius: 99px; height: 8px; overflow: hidden; margin-bottom: 10px; }
        .progress-bar-fill { background: linear-gradient(90deg, #6366f1, #38bdf8); height: 100%; border-radius: 99px; transition: width 0.5s ease; }
        .progress-stats { font-size: 0.8rem; color: #64748b; }

        .empty-results { text-align: center; padding: 80px 20px; }
        .empty-icon { font-size: 4rem; margin-bottom: 16px; }
        .empty-results h3 { font-size: 1.25rem; color: #f1f5f9; margin-bottom: 8px; }
        .empty-results p { color: #64748b; margin-bottom: 20px; }
        .btn-secondary { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: 600; }

        .toggle-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #334155; border-radius: 99px; transition: 0.3s; }
        .toggle-slider:before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
        input:checked + .toggle-slider { background: #6366f1; }
        input:checked + .toggle-slider:before { transform: translateX(20px); }

        @media (max-width: 1024px) {
          .lab-content { grid-template-columns: 1fr; }
          .launch-card { position: static; }
        }
      `}</style>
    </div>
  );
}
