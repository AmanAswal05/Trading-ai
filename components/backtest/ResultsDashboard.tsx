import React, { useEffect, useRef } from 'react';
import { ProfessionalReport } from '../../lib/backtesting/types';
import { createChart } from 'lightweight-charts';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

export default function ResultsDashboard({ report }: { report: ProfessionalReport, jobId: string }) {
  const result = report.tickerResults[0]; // For simplicity, showing first ticker

  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !result) return;
    
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: { background: { color: '#0f1929' }, textColor: '#d1d5db' },
      grid: { vertLines: { color: '#1e3a5f' }, horzLines: { color: '#1e3a5f' } },
      timeScale: { borderColor: '#1e3a5f' },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#ef4444'
    });

    // We don't have full OHLC in result by default, we have equity curve and trades.
    // Assuming `records` has enough data, or we could fetch it.
    // For now, let's use the actualReturn from records to approximate a line if OHLC isn't available,
    // Or if we need a true candlestick we must pass it from engine.ts
    const lineSeries = chart.addLineSeries({ color: '#38bdf8' });
    if (result.equityCurve) {
      lineSeries.setData(result.equityCurve.map(p => ({ time: p.date as any, value: p.equity })));
    }

    // Adding trade markers
    if (result.trades) {
      const markers = result.trades.map(t => ({
        time: t.exitDate as any,
        position: t.isWin ? 'aboveBar' as const : 'belowBar' as const,
        color: t.isWin ? '#10b981' : '#ef4444',
        shape: t.isWin ? 'arrowDown' as const : 'arrowUp' as const,
        text: t.isWin ? 'Win' : 'Loss'
      }));
      // Sort markers by time
      markers.sort((a, b) => (a.time as string).localeCompare(b.time as string));
      // Filter out duplicate dates for markers as lightweight charts doesn't allow multiple markers on same time
      const uniqueMarkers = [];
      const seenDates = new Set();
      for (const m of markers) {
          if (!seenDates.has(m.time)) {
              seenDates.add(m.time);
              uniqueMarkers.push(m);
          }
      }
      lineSeries.setMarkers(uniqueMarkers);
    }

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth || 800 });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [result]);

  const exportCSV = () => {
    if (!result.trades || result.trades.length === 0) return;
    const headers = ['Trade ID,Date,Ticker,Direction,Entry Price,Exit Price,Exit Date,Return (%),Profit ($),Reason'];
    const rows = result.trades.map(t => 
      `${t.tradeId},${t.date},${t.ticker},${t.direction},${t.entryPrice},${t.exitPrice},${t.exitDate},${t.returnPct},${t.profitAmount},${t.exitReason}`
    );
    const csvContent = headers.concat(rows).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest_trades_${result.ticker}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!result) {
    return <div style={{color: 'white'}}>No results found for this backtest.</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
        <h2>Result for {result.ticker}</h2>
        <button className="export-btn" onClick={exportCSV}>Export CSV</button>
      </div>

      {/* Metrics Row */}
      <div className="metrics-row">
        <div className="metric-card">
          <div className="metric-title">Win Rate</div>
          <div className="metric-val" style={{color: result.winRate > 50 ? '#10b981' : '#ef4444'}}>{result.winRate}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">CAGR</div>
          <div className="metric-val" style={{color: result.cagr > 0 ? '#10b981' : '#ef4444'}}>{result.cagr}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">Max Drawdown</div>
          <div className="metric-val" style={{color: '#ef4444'}}>{result.maxDrawdown}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">Sharpe Ratio</div>
          <div className="metric-val">{result.sharpeRatio.toFixed(2)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">Total Trades</div>
          <div className="metric-val">{result.totalTrades}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="chart-section">
        <h3>Price & Trade Execution</h3>
        <div ref={chartContainerRef} style={{ width: '100%', height: '400px', borderRadius: '12px', overflow: 'hidden' }} />
      </div>

      <div className="chart-section">
        <h3>Equity Curve</h3>
        <div style={{ width: '100%', height: '300px' }}>
          <ResponsiveContainer>
            <LineChart data={result.equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
              <RechartsTooltip contentStyle={{backgroundColor: '#0f1929', borderColor: '#1e3a5f'}} />
              <Line type="monotone" dataKey="equity" stroke="#38bdf8" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-section">
        <h3>Drawdown Curve</h3>
        <div style={{ width: '100%', height: '200px' }}>
          <ResponsiveContainer>
            <AreaChart data={result.drawdownCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <RechartsTooltip contentStyle={{backgroundColor: '#0f1929', borderColor: '#1e3a5f'}} />
              <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trades Table */}
      <div className="chart-section">
        <h3>Trade Log</h3>
        <div className="table-container">
          <table className="trades-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Ticker</th>
                <th>Direction</th>
                <th>Entry Price</th>
                <th>Exit Price</th>
                <th>Exit Date</th>
                <th>Return (%)</th>
                <th>Profit ($)</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.trades.slice(0, 50).map(t => (
                <tr key={t.tradeId}>
                  <td>{t.date}</td>
                  <td>{t.ticker}</td>
                  <td><span className={`badge ${t.direction === 'UP' ? 'up' : 'down'}`}>{t.direction}</span></td>
                  <td>${t.entryPrice.toFixed(2)}</td>
                  <td>${t.exitPrice.toFixed(2)}</td>
                  <td>{t.exitDate}</td>
                  <td style={{color: t.returnPct >= 0 ? '#10b981' : '#ef4444'}}>{t.returnPct.toFixed(2)}%</td>
                  <td style={{color: t.profitAmount >= 0 ? '#10b981' : '#ef4444'}}>${t.profitAmount.toFixed(2)}</td>
                  <td>{t.exitReason}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.trades.length > 50 && <div style={{textAlign: 'center', marginTop: '10px', color: '#94a3b8'}}>Showing first 50 trades</div>}
        </div>
      </div>

      {/* Source info */}
      <div className="source-info">
        <div><strong>Data Source:</strong> {result.sourceUsed}</div>
        {result.failedSourceLogs && result.failedSourceLogs.length > 0 && (
          <div style={{color: '#fbbf24', marginTop: '4px'}}>
            <strong>Fallback Logs:</strong> {result.failedSourceLogs.join(' | ')}
          </div>
        )}
      </div>

      <style>{`
        .dashboard { padding: 20px; color: #f1f5f9; display: flex; flex-direction: column; gap: 24px; }
        .metrics-row { display: flex; gap: 16px; flex-wrap: wrap; }
        .metric-card { flex: 1; min-width: 150px; background: #0f1929; border: 1px solid #1e3a5f; padding: 20px; border-radius: 12px; text-align: center; }
        .metric-title { font-size: 0.85rem; color: #94a3b8; text-transform: uppercase; font-weight: 600; margin-bottom: 8px; }
        .metric-val { font-size: 1.8rem; font-weight: 800; }
        .chart-section { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 16px; padding: 24px; }
        .chart-section h3 { margin-top: 0; margin-bottom: 20px; font-size: 1.2rem; }
        .table-container { overflow-x: auto; }
        .trades-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .trades-table th { text-align: left; padding: 12px; border-bottom: 1px solid #1e3a5f; color: #94a3b8; }
        .trades-table td { padding: 12px; border-bottom: 1px solid #1e293b; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
        .badge.up { background: rgba(16,185,129,0.15); color: #10b981; }
        .badge.down { background: rgba(239,68,68,0.15); color: #ef4444; }
        .source-info { background: #1e293b; padding: 16px; border-radius: 8px; font-size: 0.85rem; }
        .export-btn { background: #1e293b; color: #f1f5f9; border: 1px solid #334155; padding: 8px 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s; }
        .export-btn:hover { background: #334155; }
      `}</style>
    </div>
  );
}
