import React, { useState } from 'react';
import { ProfessionalReport } from '../../lib/backtesting/types';
import CandlestickChart from './CandlestickChart';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell
} from 'recharts';

export default function ResultsDashboard({ report }: { report: ProfessionalReport, jobId: string }) {
  const result = report.tickerResults[0]; // For simplicity, showing first ticker
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ADVANCED' | 'TRADES'>('OVERVIEW');

  if (!result) {
    return <div style={{color: 'white'}}>No results found for this backtest.</div>;
  }

  const exportCSV = () => {
    if (!result.trades || result.trades.length === 0) return;
    
    let csvContent = '';
    
    // Summary
    csvContent += '--- SUMMARY ---\n';
    csvContent += `Ticker,${result.ticker}\n`;
    csvContent += `Total Trades,${result.totalTrades}\n`;
    csvContent += `Win Rate (%),${result.winRate}\n`;
    csvContent += `CAGR (%),${result.cagr}\n`;
    csvContent += `Max Drawdown (%),${result.maxDrawdown}\n`;
    csvContent += `Sharpe Ratio,${result.sharpeRatio}\n`;
    csvContent += '\n';

    // Advanced Metrics
    if (result.advancedAnalytics) {
      const adv = result.advancedAnalytics;
      csvContent += '--- ADVANCED ANALYTICS ---\n';
      csvContent += `Profit Factor,${adv.profitFactor}\n`;
      csvContent += `Expectancy ($),${adv.expectancyAmount}\n`;
      csvContent += `Max Consecutive Wins,${adv.maxConsecutiveWins}\n`;
      csvContent += `Max Consecutive Losses,${adv.maxConsecutiveLosses}\n`;
      csvContent += `Benchmark Return (%),${adv.benchmark.returnPct}\n`;
      csvContent += `Alpha,${adv.benchmark.alpha}\n`;
      csvContent += '\n';
      
      if (adv.annualPerformance.length > 0) {
        csvContent += '--- ANNUAL PERFORMANCE ---\n';
        csvContent += 'Year,Trades,Win Rate (%),Return (%),Best (%),Worst (%),Max Drawdown (%)\n';
        adv.annualPerformance.forEach(y => {
          csvContent += `${y.year},${y.totalTrades},${y.winRate},${y.totalReturn},${y.bestTrade},${y.worstTrade},${y.maxDrawdown}\n`;
        });
        csvContent += '\n';
      }
    }

    // Trades
    csvContent += '--- TRADE LOG ---\n';
    csvContent += 'Trade ID,Date,Ticker,Direction,Entry Price,Exit Price,Exit Date,Return (%),Profit ($),Reason\n';
    const rows = result.trades.map(t => 
      `${t.tradeId},${t.date},${t.ticker},${t.direction},${t.entryPrice},${t.exitPrice},${t.exitDate},${t.returnPct},${t.profitAmount},${t.exitReason}`
    );
    csvContent += rows.join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backtest_trades_${result.ticker}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const adv = result.advancedAnalytics;

  return (
    <div className="dashboard">
      <div className="dashboard-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
        <h2>Result for {result.ticker}</h2>
        <button className="export-btn" onClick={exportCSV}>Export CSV</button>
      </div>

      <div className="tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1e3a5f', paddingBottom: '12px', marginBottom: '16px' }}>
        <button className={`tab-btn ${activeTab === 'OVERVIEW' ? 'active' : ''}`} onClick={() => setActiveTab('OVERVIEW')}>Overview</button>
        <button className={`tab-btn ${activeTab === 'ADVANCED' ? 'active' : ''}`} onClick={() => setActiveTab('ADVANCED')}>Advanced Analytics</button>
        <button className={`tab-btn ${activeTab === 'TRADES' ? 'active' : ''}`} onClick={() => setActiveTab('TRADES')}>Trade Log</button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'OVERVIEW' && (
        <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="metrics-row">
            <div className="metric-card">
              <div className="metric-title">Win Rate</div>
              <div className="metric-val" style={{color: result.winRate >= 50 ? '#10b981' : '#ef4444'}}>{result.winRate}%</div>
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
              {result.totalTrades === 0 && (
                <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>
                  Check debug panel for reason.
                </div>
              )}
            </div>
          </div>

          <div className="chart-section">
            <h3>Price & Trade Execution</h3>
            {result.records && result.trades ? (
               <CandlestickChart data={result.records as any} trades={result.trades} />
            ) : (
               <div style={{color: '#94a3b8', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                 OHLCV data not available for Candlestick view.
               </div>
            )}
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
          
          <div className="source-info">
            <div><strong>Data Source:</strong> {result.sourceUsed}</div>
            {result.failedSourceLogs && result.failedSourceLogs.length > 0 && (
              <div style={{color: '#fbbf24', marginTop: '4px'}}>
                <strong>Fallback Logs:</strong> {result.failedSourceLogs.join(' | ')}
              </div>
            )}
          </div>

          {result.debugStats && (
            <div className="chart-section" style={{ border: '1px dashed #fbbf24' }}>
              <h3 style={{ color: '#fbbf24' }}>⚙️ Debug Mode</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div><strong>Candles Loaded:</strong> {result.debugStats.candlesLoaded}</div>
                <div><strong>Signals Generated:</strong> {result.debugStats.signalsGenerated}</div>
                <div><strong>Trades Opened:</strong> {result.debugStats.tradesOpened}</div>
                <div><strong>Trades Closed:</strong> {result.debugStats.tradesClosed}</div>
                <div><strong>Trades Rejected:</strong> {result.debugStats.tradesRejected}</div>
              </div>
              {Object.keys(result.debugStats.rejectionReasons || {}).length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <strong style={{ color: '#ef4444' }}>Rejection Reasons:</strong>
                  <ul style={{ margin: '8px 0 0 20px', color: '#94a3b8' }}>
                    {Object.entries(result.debugStats.rejectionReasons).map(([reason, count]) => (
                      <li key={reason}>{reason}: {count as number} time(s)</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ADVANCED TAB */}
      {activeTab === 'ADVANCED' && adv && (
        <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="metrics-row">
            <div className="metric-card tooltip-container">
              <div className="metric-title">Profit Factor</div>
              <div className="metric-val" style={{color: adv.profitFactor >= 1.5 ? '#10b981' : adv.profitFactor >= 1.0 ? '#fbbf24' : '#ef4444'}}>
                {adv.profitFactor}
              </div>
              <span className="tooltip-text">Gross Profit / Absolute Gross Loss</span>
            </div>
            <div className="metric-card">
              <div className="metric-title">Expectancy</div>
              <div className="metric-val">${adv.expectancyAmount}</div>
              <div style={{fontSize: '0.85rem', color: '#94a3b8'}}>{adv.expectancyPct}%</div>
            </div>
            <div className="metric-card">
              <div className="metric-title">Avg Win vs Loss</div>
              <div className="metric-val" style={{fontSize: '1.2rem', marginTop: '10px'}}>
                <span style={{color: '#10b981'}}>${adv.averageWinningTradeAmount}</span> / <span style={{color: '#ef4444'}}>${adv.averageLosingTradeAmount}</span>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-title">Max Streaks</div>
              <div className="metric-val" style={{fontSize: '1.2rem', marginTop: '10px'}}>
                <span style={{color: '#10b981'}}>{adv.maxConsecutiveWins} W</span> / <span style={{color: '#ef4444'}}>{adv.maxConsecutiveLosses} L</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div className="chart-section" style={{ flex: 1, minWidth: '300px' }}>
              <h3>Largest Winning Trade</h3>
              {adv.largestWinningTrade ? (
                <div>
                  <div style={{color: '#10b981', fontSize: '1.5rem', fontWeight: 800}}>+{adv.largestWinningTrade.returnPct}%</div>
                  <div style={{color: '#94a3b8'}}>Amount: ${adv.largestWinningTrade.amount}</div>
                  <div style={{color: '#94a3b8'}}>Date: {adv.largestWinningTrade.date}</div>
                </div>
              ) : <div>No winning trades</div>}
            </div>
            <div className="chart-section" style={{ flex: 1, minWidth: '300px' }}>
              <h3>Largest Losing Trade</h3>
              {adv.largestLosingTrade ? (
                <div>
                  <div style={{color: '#ef4444', fontSize: '1.5rem', fontWeight: 800}}>{adv.largestLosingTrade.returnPct}%</div>
                  <div style={{color: '#94a3b8'}}>Amount: -${adv.largestLosingTrade.amount}</div>
                  <div style={{color: '#94a3b8'}}>Date: {adv.largestLosingTrade.date}</div>
                </div>
              ) : <div>No losing trades</div>}
            </div>
          </div>

          <div className="chart-section">
            <h3>Benchmark Comparison (Buy & Hold)</h3>
            <div style={{display: 'flex', gap: '32px', marginBottom: '24px'}}>
              <div>
                <div style={{color: '#94a3b8', fontSize: '0.85rem'}}>Strategy Return</div>
                <div style={{fontSize: '1.2rem', fontWeight: 700}}>{result.profitAndLoss > 0 ? '+' : ''}{result.cagr}% CAGR</div>
              </div>
              <div>
                <div style={{color: '#94a3b8', fontSize: '0.85rem'}}>Benchmark Return</div>
                <div style={{fontSize: '1.2rem', fontWeight: 700}}>{adv.benchmark.cagr}% CAGR</div>
              </div>
              <div>
                <div style={{color: '#94a3b8', fontSize: '0.85rem'}}>Alpha</div>
                <div style={{fontSize: '1.2rem', fontWeight: 700, color: adv.benchmark.alpha >= 0 ? '#10b981' : '#ef4444'}}>
                  {adv.benchmark.alpha >= 0 ? '+' : ''}{adv.benchmark.alpha}%
                </div>
              </div>
            </div>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="date" stroke="#94a3b8" type="category" allowDuplicatedCategory={false} />
                  <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
                  <RechartsTooltip contentStyle={{backgroundColor: '#0f1929', borderColor: '#1e3a5f'}} />
                  <Line data={result.equityCurve} name="Strategy" dataKey="equity" stroke="#38bdf8" dot={false} strokeWidth={2} />
                  <Line data={adv.benchmark.equityCurve} name="Benchmark" dataKey="equity" stroke="#94a3b8" dot={false} strokeWidth={2} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Heatmap */}
          <div className="chart-section">
            <h3>Monthly Returns Heatmap (%)</h3>
            <div className="heatmap-container">
              {Array.from(new Set(adv.monthlyReturns.map(m => m.year))).sort().map(year => {
                const yearData = adv.monthlyReturns.filter(m => m.year === year);
                const yearTotal = adv.annualPerformance.find(a => a.year === year)?.totalReturn || 0;
                return (
                  <div key={year} style={{display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px'}}>
                    <div style={{width: '60px', fontWeight: 700, color: '#94a3b8'}}>{year}</div>
                    {Array.from({length: 12}).map((_, i) => {
                      const monthVal = yearData.find(m => m.month === i + 1);
                      const bg = !monthVal ? '#1e293b' : monthVal.returnPct > 0 ? `rgba(16, 185, 129, ${Math.min(1, monthVal.returnPct / 10)})` : monthVal.returnPct < 0 ? `rgba(239, 68, 68, ${Math.min(1, Math.abs(monthVal.returnPct) / 10)})` : '#334155';
                      return (
                        <div key={i} className="heatmap-cell" style={{backgroundColor: bg}} title={monthVal ? `${monthVal.returnPct}%` : 'N/A'}>
                          {monthVal ? monthVal.returnPct.toFixed(1) : '-'}
                        </div>
                      );
                    })}
                    <div className="heatmap-total" style={{color: yearTotal >= 0 ? '#10b981' : '#ef4444'}}>
                      {yearTotal >= 0 ? '+' : ''}{yearTotal.toFixed(1)}%
                    </div>
                  </div>
                )
              })}
              <div style={{display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '0.75rem', color: '#64748b'}}>
                <div style={{width: '60px'}}></div>
                {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m, i) => <div key={i} style={{width: '40px', textAlign: 'center'}}>{m}</div>)}
              </div>
            </div>
          </div>

          {/* Trade Distributions */}
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            <div className="chart-section" style={{ flex: 1, minWidth: '300px' }}>
              <h3>Return Distribution</h3>
              <div style={{ width: '100%', height: '250px' }}>
                <ResponsiveContainer>
                  <BarChart data={adv.returnDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                    <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" />
                    <RechartsTooltip contentStyle={{backgroundColor: '#0f1929', borderColor: '#1e3a5f'}} cursor={{fill: '#1e293b'}} />
                    <Bar dataKey="count">
                      {adv.returnDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.bucket.includes('-') && !entry.bucket.includes('0% to 5%') ? '#ef4444' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-section" style={{ flex: 1, minWidth: '300px' }}>
              <h3>Trade Duration Distribution</h3>
              <div style={{ width: '100%', height: '250px' }}>
                <ResponsiveContainer>
                  <BarChart data={adv.tradeDuration.distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                    <XAxis dataKey="bucket" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" />
                    <RechartsTooltip contentStyle={{backgroundColor: '#0f1929', borderColor: '#1e3a5f'}} cursor={{fill: '#1e293b'}} />
                    <Bar dataKey="count" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="chart-section">
            <h3>Annual Performance</h3>
            <div className="table-container">
              <table className="trades-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Trades</th>
                    <th>Win Rate</th>
                    <th>Return</th>
                    <th>Best Trade</th>
                    <th>Worst Trade</th>
                    <th>Max Drawdown</th>
                  </tr>
                </thead>
                <tbody>
                  {adv.annualPerformance.map(y => (
                    <tr key={y.year}>
                      <td>{y.year}</td>
                      <td>{y.totalTrades}</td>
                      <td style={{color: y.winRate >= 50 ? '#10b981' : '#ef4444'}}>{y.winRate}%</td>
                      <td style={{color: y.totalReturn >= 0 ? '#10b981' : '#ef4444'}}>{y.totalReturn}%</td>
                      <td style={{color: '#10b981'}}>{y.bestTrade > 0 ? '+' : ''}{y.bestTrade}%</td>
                      <td style={{color: '#ef4444'}}>{y.worstTrade}%</td>
                      <td style={{color: '#ef4444'}}>{y.maxDrawdown}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      )}

      {/* TRADES TAB */}
      {activeTab === 'TRADES' && (
        <div className="tab-content">
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
                  {result.trades.slice(0, 100).map(t => (
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
              {result.trades.length > 100 && <div style={{textAlign: 'center', marginTop: '10px', color: '#94a3b8'}}>Showing first 100 trades</div>}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .dashboard { padding: 20px; color: #f1f5f9; display: flex; flex-direction: column; gap: 24px; }
        .tab-btn { background: transparent; color: #94a3b8; border: none; padding: 8px 16px; font-size: 1rem; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .tab-btn:hover { color: #f8fafc; }
        .tab-btn.active { color: #38bdf8; border-bottom: 2px solid #38bdf8; font-weight: 600; }
        .metrics-row { display: flex; gap: 16px; flex-wrap: wrap; }
        .metric-card { flex: 1; min-width: 150px; background: #0f1929; border: 1px solid #1e3a5f; padding: 20px; border-radius: 12px; text-align: center; position: relative; }
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
        .heatmap-cell { width: 40px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; border-radius: 4px; color: white; }
        .heatmap-total { width: 60px; text-align: right; font-weight: 700; font-size: 0.9rem; margin-left: 8px; }
        .tooltip-container .tooltip-text { visibility: hidden; width: 120px; background-color: #1e293b; color: #fff; text-align: center; border-radius: 6px; padding: 5px; position: absolute; z-index: 1; bottom: 125%; left: 50%; margin-left: -60px; opacity: 0; transition: opacity 0.3s; font-size: 0.75rem; border: 1px solid #334155; }
        .tooltip-container:hover .tooltip-text { visibility: visible; opacity: 1; }
      `}</style>
    </div>
  );
}
