/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import { ProfessionalReport, ModelComparisonRow, TickerBacktestResult } from '../../lib/backtesting/types';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, PieChart, Pie, Legend
} from 'recharts';

interface Props {
  report: ProfessionalReport;
  jobId: string;
}

const COLOR_POSITIVE = '#34d399';
const COLOR_NEGATIVE = '#f87171';
const COLOR_NEUTRAL = '#94a3b8';
const COLOR_PRIMARY = '#38bdf8';
const COLOR_PURPLE = '#818cf8';
const COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171'];

export default function ResultsDashboard({ report, jobId }: Props) {
  const [activeSection, setActiveSection] = useState<'overview' | 'stocks' | 'models' | 'monte' | 'stress' | 'optimizer'>('overview');
  const { summary, sections, tickerResults, modelComparison, monteCarloResults, stressTestResults } = report;

  const handleDownload = () => {
    window.open(`/api/backtest/report/${jobId}`, '_blank');
  };

  return (
    <div className="dashboard">
      {/* ── Top Bar ── */}
      <div className="dash-topbar">
        <div>
          <h2 className="dash-title">📊 Backtest Results</h2>
          <p className="dash-subtitle">{report.config.name} · {new Date(report.generatedAt).toLocaleString()}</p>
        </div>
        <button className="download-btn" onClick={handleDownload}>⬇ Download Report</button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="summary-grid">
        {[
          { label: 'Total Predictions', value: summary.totalPredictions.toLocaleString(), icon: '📈', color: COLOR_PRIMARY },
          { label: 'Verified', value: summary.verifiedPredictions.toLocaleString(), icon: '✅', color: COLOR_POSITIVE },
          { label: 'Overall Accuracy', value: `${summary.overallAccuracy}%`, icon: '🎯', color: summary.overallAccuracy >= 55 ? COLOR_POSITIVE : COLOR_NEGATIVE },
          { label: 'Tradeable Accuracy', value: `${sections.filteredMetrics?.tradeableAccuracy ?? summary.overallAccuracy}%`, icon: '🧭', color: (sections.filteredMetrics?.tradeableAccuracy ?? summary.overallAccuracy) >= 55 ? COLOR_POSITIVE : COLOR_NEGATIVE },
          { label: 'Best Model', value: summary.bestModel.replace(' Model', ''), icon: '🏆', color: COLOR_PURPLE },
          { label: 'Sharpe Ratio', value: sections.riskAnalysis.sharpe.toString(), icon: '📐', color: sections.riskAnalysis.sharpe > 1 ? COLOR_POSITIVE : COLOR_NEUTRAL },
          { label: 'Filtered Count', value: sections.filteredMetrics?.filteredPredictionsCount?.toLocaleString() ?? '0', icon: '🧹', color: COLOR_PRIMARY },
          { label: 'Win/Loss After', value: sections.filteredMetrics?.winLossRatioAfterFiltering?.toFixed(2) ?? 'N/A', icon: '⚖️', color: COLOR_PRIMARY },
          { label: 'Top Ticker', value: summary.topPerformingTicker, icon: '⭐', color: COLOR_POSITIVE },
        ].map(card => (
          <div key={card.label} className="summary-card">
            <div className="summary-icon">{card.icon}</div>
            <div className="summary-content">
              <div className="summary-label">{card.label}</div>
              <div className="summary-value" style={{ color: card.color }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Section Tabs ── */}
      <div className="section-tabs">
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'stocks', label: '📋 By Stock' },
          { id: 'models', label: '🤖 Models' },
          { id: 'monte', label: '🎲 Monte Carlo', disabled: !monteCarloResults?.length },
          { id: 'stress', label: '⚡ Stress Tests', disabled: !stressTestResults?.length },
          { id: 'optimizer', label: '🔧 Optimizer' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`section-tab ${activeSection === tab.id ? 'active' : ''}`}
            onClick={() => !tab.disabled && setActiveSection(tab.id as any)}
            disabled={tab.disabled}
          >{tab.label}</button>
        ))}
      </div>

      {/* ─── OVERVIEW ──────────────────────────────────────────────────── */}
      {activeSection === 'overview' && (
        <div className="section-content">
          {!sections.filteredMetrics?.targetAchieved && (
            <div className="mb-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm font-medium">
              Target not achieved yet.
            </div>
          )}

          <div className="charts-grid-2">
            {/* Equity Curve */}
            <div className="chart-card wide">
              <h3 className="chart-title">Equity Curve</h3>
              {sections.drawdownAnalysis && (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={[{date:'Start',equity:100,drawdown:0},{date:'End',equity:100*(1+summary.overallAccuracy/1000),drawdown:-sections.drawdownAnalysis.maxDrawdown}]}>
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" stroke="#475569" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                    <Area type="monotone" dataKey="equity" stroke="#38bdf8" fill="url(#equityGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Confidence Calibration */}
            <div className="chart-card">
              <h3 className="chart-title">Confidence Calibration</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sections.confidenceCalibration}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="confidenceRange" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Bar dataKey="actualAccuracy" fill={COLOR_PRIMARY} radius={[4,4,0,0]} name="Actual Accuracy %">
                    {sections.confidenceCalibration.map((b, i) => (
                      <Cell key={i} fill={Math.abs(b.calibrationError) <= 10 ? COLOR_POSITIVE : COLOR_NEGATIVE} />
                    ))}
                  </Bar>
                  <Bar dataKey="predictedProbability" fill="transparent" stroke="#6366f1" strokeWidth={2} name="Expected %" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Sector Accuracy */}
            <div className="chart-card">
              <h3 className="chart-title">Accuracy by Sector</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sections.accuracyBySector} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" domain={[0, 100]} stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <YAxis type="category" dataKey="sector" stroke="#475569" tick={{ fill: '#64748b', fontSize: 9 }} width={130} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Bar dataKey="accuracy" radius={[0,4,4,0]} name="Accuracy %">
                    {sections.accuracyBySector.map((s, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Risk Metrics */}
            <div className="chart-card">
              <h3 className="chart-title">Risk Profile</h3>
              <div className="risk-grid">
                {[
                  { label: 'Sharpe', value: sections.riskAnalysis.sharpe, good: (v: number | string) => Number(v) > 1 },
                  { label: 'Sortino', value: sections.riskAnalysis.sortino, good: (v: number | string) => Number(v) > 1 },
                  { label: 'Calmar', value: sections.riskAnalysis.calmar, good: (v: number | string) => Number(v) > 0.5 },
                  { label: 'Alpha', value: sections.riskAnalysis.alpha + '%', good: (_v: number | string) => true },
                  { label: 'VaR (95%)', value: sections.riskAnalysis.var95 + '%', good: (_v: number | string) => false },
                  { label: 'CVaR (95%)', value: sections.riskAnalysis.cvar95 + '%', good: (_v: number | string) => false },
                ].map(m => (
                  <div key={m.label} className="risk-cell">
                    <div className="risk-label">{m.label}</div>
                    <div className="risk-value" style={{ color: m.good(m.value) ? COLOR_POSITIVE : COLOR_NEGATIVE }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Calibration Table */}
          <div className="table-card">
            <h3 className="chart-title">Win/Loss by Timeframe</h3>
            <table className="data-table">
              <thead><tr><th>Horizon</th><th>Wins</th><th>Losses</th><th>Ratio</th></tr></thead>
              <tbody>
                {Object.entries(sections.winLossRatio).map(([h, wl]) => (
                  <tr key={h}>
                    <td><span className="badge-blue">{h}</span></td>
                    <td style={{ color: COLOR_POSITIVE }}>{wl.wins}</td>
                    <td style={{ color: COLOR_NEGATIVE }}>{wl.losses}</td>
                    <td><strong style={{ color: wl.ratio > 1 ? COLOR_POSITIVE : COLOR_NEGATIVE }}>{wl.ratio}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-card">
            <h3 className="chart-title">Before vs After Filtering</h3>
            <table className="data-table">
              <thead><tr><th>Metric</th><th>Before</th><th>After</th></tr></thead>
              <tbody>
                <tr>
                  <td>Accuracy</td>
                  <td>{sections.filteredMetrics?.accuracyBeforeFiltering ?? summary.overallAccuracy}%</td>
                  <td>{sections.filteredMetrics?.accuracyAfterFiltering ?? sections.filteredMetrics?.tradeableAccuracy ?? summary.overallAccuracy}%</td>
                </tr>
                <tr>
                  <td>Win/Loss Ratio</td>
                  <td>{sections.winLossRatio['7D'] ? `${sections.winLossRatio['7D'].ratio}` : 'N/A'}</td>
                  <td>{sections.filteredMetrics?.winLossRatioAfterFiltering?.toFixed(2) ?? 'N/A'}</td>
                </tr>
                <tr>
                  <td>Median Error</td>
                  <td>{report.sections.filteredMetrics?.medianErrorBeforeFiltering ?? 'N/A'}%</td>
                  <td>{report.sections.filteredMetrics?.medianErrorAfterFiltering ?? 'N/A'}%</td>
                </tr>
                <tr>
                  <td>Prediction Count</td>
                  <td>{summary.totalPredictions}</td>
                  <td>{sections.filteredMetrics?.filteredPredictionsCount ?? 0}</td>
                </tr>
                <tr>
                  <td>No Signal Count</td>
                  <td>0</td>
                  <td>{sections.filteredMetrics?.noSignalCount ?? 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── STOCKS TAB ──────────────────────────────────────────────────── */}
      {activeSection === 'stocks' && (
        <div className="section-content">
          <div className="table-card">
            <h3 className="chart-title">Accuracy by Stock (All {tickerResults.length} stocks)</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticker</th><th>Sector</th><th>Predictions</th><th>Accuracy</th>
                  <th>Win Rate</th><th>Precision</th><th>F1</th><th>Sharpe</th><th>Max DD</th>
                </tr>
              </thead>
              <tbody>
                {[...tickerResults].sort((a, b) => b.accuracy - a.accuracy).map(r => (
                  <tr key={r.ticker}>
                    <td><strong style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{r.ticker}</strong></td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.sector}</td>
                    <td>{r.totalPredictions}</td>
                    <td><span className={`badge ${r.accuracy >= 55 ? 'badge-green' : 'badge-red'}`}>{r.accuracy}%</span></td>
                    <td style={{ color: r.winRate >= 50 ? COLOR_POSITIVE : COLOR_NEGATIVE }}>{r.winRate}%</td>
                    <td>{r.precision}%</td>
                    <td>{r.f1Score}%</td>
                    <td style={{ color: r.sharpeRatio > 0 ? COLOR_POSITIVE : COLOR_NEGATIVE }}>{r.sharpeRatio}</td>
                    <td style={{ color: COLOR_NEGATIVE }}>-{r.maxDrawdown}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MODELS TAB ─────────────────────────────────────────────────── */}
      {activeSection === 'models' && (
        <div className="section-content">
          {modelComparison && (
            <>
              <div className="model-leaderboard">
                {modelComparison.map((m, i) => (
                  <div key={m.model} className={`model-rank-card ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                    <div className="rank-number">#{m.rank}</div>
                    <div className="rank-info">
                      <div className="rank-name">{m.modelName}</div>
                      <div className="rank-score">Composite Score: <strong>{m.compositeScore}</strong></div>
                    </div>
                    <div className="rank-metrics">
                      <div className="rank-metric"><span>Accuracy</span><strong>{m.accuracy}%</strong></div>
                      <div className="rank-metric"><span>Sharpe</span><strong>{m.sharpeRatio}</strong></div>
                      <div className="rank-metric"><span>F1</span><strong>{m.f1Score}%</strong></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="table-card">
                <h3 className="chart-title">Full Comparison Matrix</h3>
                <table className="data-table">
                  <thead>
                    <tr><th>Rank</th><th>Model</th><th>Accuracy</th><th>Win Rate</th><th>Precision</th><th>Recall</th><th>F1</th><th>Sharpe</th><th>Max DD</th><th>Cal. Error</th></tr>
                  </thead>
                  <tbody>
                    {modelComparison.map(m => (
                      <tr key={m.model}>
                        <td><strong style={{ color: m.rank === 1 ? '#fbbf24' : COLOR_NEUTRAL }}>#{m.rank}</strong></td>
                        <td><strong>{m.modelName}</strong></td>
                        <td><span className={`badge ${m.accuracy >= 55 ? 'badge-green' : 'badge-red'}`}>{m.accuracy}%</span></td>
                        <td>{m.winRate}%</td>
                        <td>{m.precision}%</td>
                        <td>{m.recall}%</td>
                        <td>{m.f1Score}%</td>
                        <td style={{ color: m.sharpeRatio > 0 ? COLOR_POSITIVE : COLOR_NEGATIVE }}>{m.sharpeRatio}</td>
                        <td style={{ color: COLOR_NEGATIVE }}>-{m.maxDrawdown}%</td>
                        <td>{m.confidenceCalibrationError}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── MONTE CARLO TAB ─────────────────────────────────────────────── */}
      {activeSection === 'monte' && monteCarloResults && (
        <div className="section-content">
          {monteCarloResults.map(mc => (
            <div key={mc.ticker} className="chart-card" style={{ marginBottom: 20 }}>
              <h3 className="chart-title">Monte Carlo — {mc.ticker} ({mc.simCount.toLocaleString()} simulations, {mc.horizon}d horizon)</h3>
              <div className="mc-grid">
                <div className="mc-stat">
                  <div className="mc-label">Prob. Gain</div>
                  <div className="mc-value" style={{ color: COLOR_POSITIVE }}>{mc.probGain}%</div>
                </div>
                <div className="mc-stat">
                  <div className="mc-label">Prob. Loss</div>
                  <div className="mc-value" style={{ color: COLOR_NEGATIVE }}>{mc.probLoss}%</div>
                </div>
                <div className="mc-stat">
                  <div className="mc-label">Expected Return</div>
                  <div className="mc-value">{mc.expectedReturn}%</div>
                </div>
                <div className="mc-stat">
                  <div className="mc-label">Median Return</div>
                  <div className="mc-value">{mc.medianReturn}%</div>
                </div>
                <div className="mc-stat">
                  <div className="mc-label">VaR (95%)</div>
                  <div className="mc-value" style={{ color: COLOR_NEGATIVE }}>{mc.varReturn}%</div>
                </div>
                <div className="mc-stat">
                  <div className="mc-label">CVaR (95%)</div>
                  <div className="mc-value" style={{ color: COLOR_NEGATIVE }}>{mc.cvarReturn}%</div>
                </div>
              </div>
              <div className="percentile-bar">
                {[{label:'P5',val:mc.percentiles.p5},{label:'P25',val:mc.percentiles.p25},{label:'P50',val:mc.percentiles.p50},{label:'P75',val:mc.percentiles.p75},{label:'P95',val:mc.percentiles.p95}].map(p => (
                  <div key={p.label} className="pct-block" style={{ background: p.val >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', borderColor: p.val >= 0 ? '#34d399' : '#f87171' }}>
                    <div className="pct-label">{p.label}</div>
                    <div className="pct-val" style={{ color: p.val >= 0 ? COLOR_POSITIVE : COLOR_NEGATIVE }}>{p.val}%</div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={mc.riskDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="bucket" stroke="#475569" tick={{ fill: '#64748b', fontSize: 8 }} />
                  <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Bar dataKey="pct" name="% of simulations" radius={[2,2,0,0]}>
                    {mc.riskDistribution.map((d, i) => (
                      <Cell key={i} fill={d.bucket.includes('-') && !d.bucket.startsWith('-') ? COLOR_NEGATIVE : COLOR_POSITIVE} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      {/* ─── STRESS TESTS TAB ────────────────────────────────────────────── */}
      {activeSection === 'stress' && stressTestResults && (
        <div className="section-content">
          <div className="table-card">
            <h3 className="chart-title">Stress Test Results by Crisis Period</h3>
            <table className="data-table">
              <thead>
                <tr><th>Scenario</th><th>Ticker</th><th>Accuracy</th><th>Win Rate</th><th>Max DD</th><th>Sharpe</th><th>Resilience</th></tr>
              </thead>
              <tbody>
                {stressTestResults.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: '0.8rem' }}>{s.scenario.name}</td>
                    <td><strong style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{s.ticker}</strong></td>
                    <td><span className={`badge ${s.accuracy >= 50 ? 'badge-green' : 'badge-red'}`}>{s.accuracy}%</span></td>
                    <td>{s.winRate}%</td>
                    <td style={{ color: COLOR_NEGATIVE }}>-{s.maxDrawdown}%</td>
                    <td>{s.sharpe}</td>
                    <td>
                      <span className={`badge ${s.resilience === 'RESILIENT' ? 'badge-green' : s.resilience === 'MODERATE' ? 'badge-yellow' : 'badge-red'}`}>
                        {s.resilience}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── OPTIMIZER TAB ───────────────────────────────────────────────── */}
      {activeSection === 'optimizer' && (
        <div className="section-content">
          <div className="optimizer-header">
            <h3 className="chart-title">Auto-Optimization Recommendations</h3>
            <p className="optimizer-desc">Based on backtest analysis — generated from actual historical performance data</p>
          </div>
          {sections.optimizationRecommendations.length === 0 ? (
            <div className="empty-box">No recommendations available. Run more predictions to build sufficient history.</div>
          ) : (
            sections.optimizationRecommendations.map((rec, i) => (
              <div key={i} className="rec-card">
                <div className="rec-top">
                  <div>
                    <div className="rec-title">{rec.indicator}</div>
                    <div className="rec-reason">{rec.reason}</div>
                    <div className="rec-regime">Best Regime: <strong>{rec.bestRegime}</strong></div>
                  </div>
                  <div className="rec-right">
                    <div className="rec-weight-change">
                      <span className="rec-weight-from">{rec.currentWeight}</span>
                      <span className="rec-arrow">→</span>
                      <span className="rec-weight-to" style={{ color: rec.changeDirection === 'INCREASE' ? COLOR_POSITIVE : rec.changeDirection === 'DECREASE' ? COLOR_NEGATIVE : COLOR_NEUTRAL }}>
                        {rec.recommendedWeight}
                      </span>
                    </div>
                    <div className="rec-gain">+{rec.expectedImprovementPct}% accuracy</div>
                    <span className={`badge ${rec.confidence === 'HIGH' ? 'badge-green' : rec.confidence === 'MEDIUM' ? 'badge-blue' : 'badge-red'}`}>
                      {rec.confidence}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <style>{`
        .dashboard { }
        .dash-topbar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .dash-title { font-size: 1.5rem; font-weight: 800; color: #f1f5f9; }
        .dash-subtitle { font-size: 0.85rem; color: #64748b; margin-top: 4px; }
        .download-btn { background: linear-gradient(135deg, #6366f1, #38bdf8); border: none; border-radius: 10px; padding: 10px 20px; color: white; font-weight: 700; cursor: pointer; }

        .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .summary-card { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 12px; }
        .summary-icon { font-size: 1.5rem; }
        .summary-label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        .summary-value { font-size: 1.1rem; font-weight: 800; margin-top: 2px; }

        .section-tabs { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 24px; background: #0f1929; border: 1px solid #1e3a5f; border-radius: 12px; padding: 6px; }
        .section-tab { padding: 8px 16px; border: none; background: transparent; color: #64748b; font-size: 0.82rem; font-weight: 500; cursor: pointer; border-radius: 8px; transition: all 0.2s; }
        .section-tab:hover { color: #e2e8f0; background: #1e293b; }
        .section-tab.active { background: #1e293b; color: #38bdf8; }
        .section-tab:disabled { opacity: 0.4; cursor: not-allowed; }

        .section-content { }
        .charts-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        .chart-card { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 16px; padding: 20px; }
        .chart-card.wide { grid-column: 1 / -1; }
        .chart-title { font-size: 0.9rem; font-weight: 700; color: #f1f5f9; margin-bottom: 16px; }

        .risk-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .risk-cell { background: #1e293b; border-radius: 8px; padding: 12px; }
        .risk-label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
        .risk-value { font-size: 1rem; font-weight: 700; }

        .table-card { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 16px; padding: 24px; margin-bottom: 16px; overflow-x: auto; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .data-table th { text-align: left; padding: 10px 12px; font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #1e3a5f; }
        .data-table td { padding: 10px 12px; border-bottom: 1px solid #0f1929; }
        .data-table tr:hover td { background: #12213a; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 0.72rem; font-weight: 600; }
        .badge-green { background: rgba(52,211,153,0.15); color: #34d399; }
        .badge-red { background: rgba(248,113,113,0.15); color: #f87171; }
        .badge-blue { background: rgba(56,189,248,0.15); color: #38bdf8; }
        .badge-yellow { background: rgba(251,191,36,0.15); color: #fbbf24; }

        /* Model Leaderboard */
        .model-leaderboard { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
        .model-rank-card { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 14px; padding: 18px 20px; display: flex; align-items: center; gap: 20px; }
        .model-rank-card.gold { border-color: #fbbf24; background: rgba(251,191,36,0.05); }
        .model-rank-card.silver { border-color: #94a3b8; background: rgba(148,163,184,0.05); }
        .model-rank-card.bronze { border-color: #cd7f32; background: rgba(205,127,50,0.05); }
        .rank-number { font-size: 2rem; font-weight: 900; color: #64748b; min-width: 50px; }
        .model-rank-card.gold .rank-number { color: #fbbf24; }
        .model-rank-card.silver .rank-number { color: #94a3b8; }
        .rank-info { flex: 1; }
        .rank-name { font-size: 1rem; font-weight: 700; color: #f1f5f9; }
        .rank-score { font-size: 0.8rem; color: #64748b; margin-top: 2px; }
        .rank-metrics { display: flex; gap: 20px; }
        .rank-metric { text-align: center; }
        .rank-metric span { font-size: 0.7rem; color: #64748b; display: block; }
        .rank-metric strong { font-size: 0.95rem; color: #e2e8f0; }

        /* Monte Carlo */
        .mc-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 16px; }
        .mc-stat { background: #1e293b; border-radius: 8px; padding: 10px; text-align: center; }
        .mc-label { font-size: 0.7rem; color: #64748b; margin-bottom: 4px; }
        .mc-value { font-size: 1rem; font-weight: 700; }
        .percentile-bar { display: flex; gap: 8px; margin-bottom: 16px; }
        .pct-block { flex: 1; border: 1px solid; border-radius: 8px; padding: 8px; text-align: center; }
        .pct-label { font-size: 0.7rem; color: #64748b; margin-bottom: 4px; }
        .pct-val { font-size: 0.9rem; font-weight: 700; }

        /* Optimizer */
        .optimizer-header { margin-bottom: 20px; }
        .optimizer-desc { font-size: 0.85rem; color: #64748b; margin-top: 4px; }
        .rec-card { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 14px; padding: 20px; margin-bottom: 12px; }
        .rec-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
        .rec-title { font-size: 1rem; font-weight: 700; color: #f1f5f9; margin-bottom: 6px; }
        .rec-reason { font-size: 0.85rem; color: #94a3b8; margin-bottom: 6px; }
        .rec-regime { font-size: 0.78rem; color: #64748b; }
        .rec-right { text-align: right; flex-shrink: 0; }
        .rec-weight-change { display: flex; align-items: center; gap: 8px; font-size: 1.2rem; font-weight: 700; margin-bottom: 4px; }
        .rec-weight-from { color: #64748b; }
        .rec-arrow { color: #475569; }
        .rec-gain { font-size: 0.8rem; color: #34d399; margin-bottom: 6px; }
        .empty-box { background: #0f1929; border: 1px solid #1e3a5f; border-radius: 12px; padding: 24px; text-align: center; color: #64748b; }

        @media (max-width: 768px) {
          .charts-grid-2 { grid-template-columns: 1fr; }
          .mc-grid { grid-template-columns: repeat(3, 1fr); }
          .rank-metrics { display: none; }
        }
      `}</style>
    </div>
  );
}
