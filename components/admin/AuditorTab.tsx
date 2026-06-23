/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */

import React from 'react';
import { Search, Save, RotateCcw, Play, CheckCircle2, XCircle, Activity, RefreshCw, AlertCircle, Sliders, ShieldCheck, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function AuditorTab(props: any) {
  const {
    auditTicker, setAuditTicker, manualTicker, setManualTicker, runAudit, loadingAudit, auditError, auditResult,
    auditChartData, tuningConfig, setTuningConfig, isConfigModified, handleSliderChange,
    resetToDefault, saveTuningConfig, isTunedActive, formatConvertedPrice, formatPrice
  } = props;

  return (
    <>
      {/* TAB 1: ACCURACY AUDITOR & HYPERPARAMETER TUNER */}
      
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
                            dot={(props: Record<string, any>) => {
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
                        {auditResult.auditHistory.map((row: Record<string, any>, idx: number) => (
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

    </>
  );
}
