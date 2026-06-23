/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
 
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle2, ShieldCheck, Activity, BarChart3, ArrowLeft, Info, HelpCircle, Percent } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

function formatMetric(value: unknown, decimals: number, suffix = ''): string {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `${numericValue.toFixed(decimals)}${suffix}` : 'N/A';
}

function formatPrice(value: unknown): string {
  const formatted = formatMetric(value, 2);
  return formatted === 'N/A' ? formatted : `$${formatted}`;
}

export default function PublicTrustPanelPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTrustStats = async () => {
      try {
        const res = await fetch('/api/public/trust-stats', { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Failed to load verified trust statistics');
        }
        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load verified results.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrustStats();
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-bg-primary text-text-primary transition-colors duration-300 py-10 px-4 sm:px-6 lg:px-8">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-5%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent-blue/5 blur-[120px]" />
        <div className="absolute bottom-[10%] left-[-10%] w-[35%] h-[35%] rounded-full bg-premium-gold/5 blur-[140px]" />
      </div>

      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        {/* Back Link & Header */}
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Home
          </Link>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-accent-blue/20 bg-accent-blue/5 text-[10px] font-bold text-accent-blue uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 animate-pulse" /> Verified Public Registry
              </span>
              <h1 className="text-3xl font-extrabold text-text-primary mt-2 tracking-tight">
                Public Trust & Accuracy Panel
              </h1>
              <p className="text-sm text-text-secondary mt-1 max-w-2xl leading-relaxed">
                StockPredict AI does not rely on claims. We track, verify, and publish the performance of every single generated prediction against actual historical outcomes.
              </p>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-bg-card/75 border border-border-custom rounded-xl self-start md:self-auto shadow-xs backdrop-blur-xs">
              <ShieldCheck className="w-5 h-5 text-accent-green" />
              <div className="text-[10px] font-medium text-text-secondary">
                <span className="font-bold text-text-primary block">Immutable Records</span>
                Verification calculations are automated and locked.
              </div>
            </div>
          </div>
        </div>

        {/* Loader or Error */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 bg-bg-card border border-border-custom rounded-2xl shadow-sm">
            <LoadingSpinner />
            <p className="text-xs text-text-secondary mt-2">Loading verified registry...</p>
          </div>
        )}

        {error && (
          <div className="p-5 bg-accent-red/10 border border-accent-red/20 text-accent-red rounded-xl text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loaded view */}
        {stats && (
          <div className="space-y-8">
            {stats.totalCount === 0 ? (
              <div className="p-12 text-center bg-bg-card border border-border-custom rounded-2xl shadow-sm space-y-3">
                <Activity className="w-12 h-12 text-text-muted mx-auto animate-pulse" />
                <h3 className="text-base font-bold text-text-primary">No Verified Predictions Found</h3>
                <p className="text-xs text-text-secondary max-w-md mx-auto">
                  Verification data requires seeding and updates. Ask the system administrator to run backtests inside the admin console to generate historical logs.
                </p>
              </div>
            ) : (
              <>
                {/* Metrics Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Badge card 1 */}
                  <div className="p-6 bg-bg-card border border-border-custom rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-4 text-accent-green opacity-10">
                      <CheckCircle2 className="w-16 h-16" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondary block">Overall Model Accuracy</span>
                      <h2 className="text-4xl font-extrabold text-accent-green mt-2">
                        {stats.overallAccuracy ?? stats.accuracy}%
                      </h2>
                    </div>
                    <p className="text-xs text-text-muted mt-4">
                      All verified predictions before signal filtering.
                    </p>
                  </div>

                  {/* Badge card 2 */}
                  <div className="p-6 bg-bg-card border border-border-custom rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-4 text-accent-blue opacity-10">
                      <Activity className="w-16 h-16" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondary block">Tradeable Signal Accuracy</span>
                      <h2 className="text-4xl font-extrabold text-text-primary mt-2">
                        {stats.tradeableAccuracy ?? stats.accuracy}%
                      </h2>
                    </div>
                    <p className="text-xs text-text-muted mt-4">
                      Only `MODERATE_SIGNAL` and `STRONG_SIGNAL` predictions count here.
                    </p>
                  </div>

                  {/* Badge card 3 */}
                  <div className="p-6 bg-bg-card border border-border-custom rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-4 text-premium-gold opacity-10">
                      <Percent className="w-16 h-16" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondary block">Median Price Error</span>
                      <h2 className="text-4xl font-extrabold text-premium-gold mt-2">
                        {stats.medianError !== undefined ? `${stats.medianError}%` : 'N/A'}
                      </h2>
                    </div>
                    <p className="text-xs text-text-muted mt-4">
                      Average point forecast error: {stats.avgError !== undefined ? `${stats.avgError}%` : 'N/A'}
                    </p>
                  </div>

                  {/* Badge card 4 */}
                  <div className="p-6 bg-bg-card border border-border-custom rounded-2xl shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-4 text-accent-green opacity-10">
                      <ShieldCheck className="w-16 h-16" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-text-secondary block">Filtered Predictions</span>
                      <h2 className="text-xl font-extrabold text-accent-green mt-4 flex items-center gap-1.5 uppercase">
                        {stats.filteredPredictionsCount ?? 0}
                      </h2>
                    </div>
                    <p className="text-xs text-text-muted mt-5.5">
                      Predictions excluded from the tradeable signal set.
                    </p>
                  </div>
                </div>

                {/* Charts section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Accuracy timeline chart */}
                  <div className="p-5 border border-border-custom bg-bg-card rounded-2xl shadow-sm space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-accent-blue" />
                      Historical Accuracy Trend
                    </h3>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={stats.accuracyTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={9} />
                          <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(20,24,33,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}
                          />
                          <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Calibration chart */}
                  <div className="p-5 border border-border-custom bg-bg-card rounded-2xl shadow-sm space-y-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-accent-blue" />
                        Confidence Calibration
                      </h3>
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        Verifies that forecasts with higher confidence actually yield higher correctness rates.
                      </p>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.confidenceCalibration}>
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
                </div>

                {/* Model Version Performance Metrics */}
                {stats.accuracyByModel && stats.accuracyByModel.length > 0 && (
                  <div className="p-6 border border-border-custom bg-bg-card rounded-2xl shadow-sm space-y-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4 text-premium-gold" />
                        AI Model Performance Audit
                      </h3>
                      <p className="text-[10px] text-text-secondary mt-0.5">
                        StockPredict AI deploys three specialized model configurations, each designed to capture distinct market dynamics.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {['V1', 'V2', 'V3'].map((version) => {
                        const model = stats.accuracyByModel.find((m: any) => m.modelVersion === version) || {
                          modelVersion: version,
                          total: 0,
                          accuracy: 0,
                          avgError: 0,
                          calibrationRating: 'Insufficient Data'
                        };

                        const focus = version === 'V1' ? 'Balanced Mode' : version === 'V2' ? 'Momentum Engine' : 'Trend Tracker';
                        const description = version === 'V1' 
                          ? 'Standard balanced weight allocation across technical oscillators (RSI, MACD) and moving averages.'
                          : version === 'V2'
                          ? 'Aggressive momentum-focused tracking optimized for high-beta stocks and short-term trends.'
                          : 'Conservative trend-focused tracking emphasizing long-term support zones and moving averages.';

                        return (
                          <div 
                            key={version} 
                            className="p-4 bg-bg-secondary/25 border border-border-custom rounded-xl flex flex-col justify-between text-xs"
                          >
                            <div className="space-y-1">
                              <span className="text-[8px] font-mono font-bold text-text-secondary uppercase">
                                {focus}
                              </span>
                              <h4 className="text-xs font-bold text-text-primary mt-0.5">
                                Model {version}
                              </h4>
                              <p className="text-[10px] text-text-secondary leading-relaxed mt-1">
                                {description}
                              </p>
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-custom/40 pt-3 text-[10px] text-text-secondary">
                              <div>
                                <span className="text-[8px] uppercase text-text-muted font-bold block">Forecasts</span>
                                <span className="font-bold text-text-primary">{model.total}</span>
                              </div>
                              <div>
                                <span className="text-[8px] uppercase text-text-muted font-bold block">Win Rate</span>
                                <span className="font-bold text-accent-green">{formatMetric(model.accuracy, 1, '%')}</span>
                              </div>
                              <div>
                                <span className="text-[8px] uppercase text-text-muted font-bold block">Median Error</span>
                                <span className="font-bold text-premium-gold">{formatMetric(model.medianError, 2, '%')}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recently verified predictions table */}
                <div className="p-6 border border-border-custom bg-bg-card rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                      Recently Audited Prediction Logs
                    </h3>
                    <span className="text-[10px] text-text-secondary flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-text-muted" /> Showing last 10 outcomes
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border-custom text-text-secondary font-semibold">
                          <th className="py-3 px-1">Ticker</th>
                          <th className="py-3">Forecast Date</th>
                          <th className="py-3 text-center">Timeframe</th>
                          <th className="py-3 text-right">Entry Price</th>
                          <th className="py-3 text-right">Target Price</th>
                          <th className="py-3 text-center">Forecast</th>
                          <th className="py-3 text-right">Actual Outcome</th>
                          <th className="py-3 text-center">Result</th>
                          <th className="py-3 text-right">Error %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-custom/50">
                        {stats.recentVerified.map((row: any) => {
                          const dateStr = new Date(row.prediction_date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: '2-digit',
                          });

                          const resultColors: Record<string, string> = {
                            CORRECT: 'bg-accent-green/15 text-accent-green border-accent-green/20',
                            INCORRECT: 'bg-accent-red/15 text-accent-red border-accent-red/20',
                            PARTIALLY_CORRECT: 'bg-accent-blue/15 text-accent-blue border-accent-blue/20',
                            NEUTRAL: 'bg-text-muted/15 text-text-secondary border-text-muted/20',
                          };

                          return (
                            <tr key={row.id} className="hover:bg-bg-secondary/35 text-text-secondary">
                              <td className="py-3 px-1 font-mono font-bold text-text-primary">{row.ticker}</td>
                              <td className="py-3">{dateStr}</td>
                              <td className="py-3 text-center font-mono font-bold text-[10px]">{row.timeframe}</td>
                              <td className="py-3 text-right">{formatPrice(row.current_price)}</td>
                              <td className="py-3 text-right">{formatPrice(row.predicted_price)}</td>
                              <td className="py-3 text-center">
                                <span className={`text-[10px] font-bold ${row.predicted_direction === 'UP' ? 'text-accent-green' : row.predicted_direction === 'DOWN' ? 'text-accent-red' : 'text-text-muted'}`}>
                                  {row.predicted_direction}
                                </span>
                              </td>
                              <td className="py-3 text-right font-medium text-text-primary">
                                {row.actual_price == null ? '-' : formatPrice(row.actual_price)}
                              </td>
                              <td className="py-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-bold border ${resultColors[row.prediction_result] || 'bg-bg-secondary text-text-secondary'}`}>
                                  {row.prediction_result}
                                </span>
                              </td>
                              <td className="py-3 text-right font-mono text-premium-gold font-medium">
                                {row.error_percentage == null ? '-' : formatMetric(row.error_percentage, 2, '%')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
