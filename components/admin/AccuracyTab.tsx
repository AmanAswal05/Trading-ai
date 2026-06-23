/* eslint-disable @typescript-eslint/no-unused-vars, react/no-unescaped-entities, @typescript-eslint/no-explicit-any */

import React from 'react';
import { Activity, RefreshCw, Sliders, Play, ShieldAlert, ShieldCheck, Database, Percent, CheckCircle2, AlertCircle, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AccuracyStats } from '@/lib/admin/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function AccuracyTab(props: any) {
  const {
    accuracyTimeframe, setAccuracyTimeframe, loadAccuracyStats,
    triggerVerification, verifyingPredictions,
    runLearningCycle, runningLearning,
    batchSize, setBatchSize, runningBacktest, triggerBacktest,
    runMigration, runningMigration, migrationResult,
    loadingAccuracy, accuracyStats, accuracyError,
    indicatorPerformance, regimeStats,
    convert
  } = props;

  const normalizeCalibrationBucket = (bucket: Record<string, any>) => {
    const expected = bucket.predictedConfidence ?? bucket.expectedAccuracy ?? bucket.calibratedValue ?? 0;
    const actual = bucket.actualAccuracy ?? bucket.winRate ?? null;
    const error = bucket.calibrationError ?? bucket.calGap ?? null;
    const total = bucket.total ?? bucket.sampleSize ?? 0;
    return {
      bucket: bucket.bucket ?? bucket.range ?? `${bucket.rangeMin ?? ''}-${bucket.rangeMax ?? ''}`,
      total,
      expectedAccuracy: Number(expected),
      actualAccuracy: actual == null ? null : Number(actual),
      calibrationError: error == null ? null : Number(error),
      reliability: bucket.reliability ?? (total < 20 ? 'UNRELIABLE' : 'RELIABLE'),
      sampleSize: bucket.sampleSize ?? total,
      predictedConfidence: bucket.predictedConfidence ?? bucket.expectedAccuracy ?? bucket.calibratedValue ?? null,
      range: bucket.range ?? bucket.bucket,
    };
  };

  return (
    <>
      {/* TAB 0: ACCURACY VERIFICATION DASHBOARD */}
      
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
                <label htmlFor="predictionBatchSize" className="sr-only">
                  Number of predictions
                </label>
                <select
                  id="predictionBatchSize"
                  name="predictionBatchSize"
                  disabled={runningBacktest}
                  className="bg-transparent text-[11px] font-semibold text-text-primary outline-none border-none py-1 px-1.5 cursor-pointer"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                >
                  <option value={100} className="bg-bg-card text-text-primary">100 Predictions</option>
                  <option value={1_000} className="bg-bg-card text-text-primary">1,000 Predictions</option>
                  <option value={10_000} className="bg-bg-card text-text-primary">10,000 Predictions</option>
                  <option value={100_000} className="bg-bg-card text-text-primary">100,000 Predictions</option>
                </select>
                <button
                  onClick={() => triggerBacktest(batchSize)}
                  disabled={runningBacktest}
                  className="flex items-center gap-1 px-2.5 py-1 bg-accent-blue hover:bg-opacity-90 disabled:bg-opacity-50 text-white text-[11px] font-semibold rounded transition-all cursor-pointer"
                >
                  <Play className={`w-2.5 h-2.5 ${runningBacktest ? 'animate-pulse' : ''}`} />
                  Seed
                </button>
              </div>

              {/* Fix Schema button — applies pending ALTER TABLE migrations */}
              <button
                onClick={runMigration}
                disabled={runningMigration}
                title="Applies calibrated_prob_up and max_position_size columns to Supabase if missing"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-red/80 hover:bg-accent-red disabled:bg-opacity-50 text-white text-[11px] font-semibold rounded-lg transition-all cursor-pointer"
              >
                <Database className={`w-3 h-3 ${runningMigration ? 'animate-spin' : ''}`} />
                {runningMigration ? 'Applying...' : 'Fix Schema'}
              </button>
            </div>
          </div>

          {/* Migration result banner */}
          {migrationResult && (
            <div className={`p-4 rounded-xl text-xs font-medium flex items-start gap-2 border ${
              migrationResult.ok
                ? 'bg-accent-green/10 border-accent-green/20 text-accent-green'
                : 'bg-accent-red/10 border-accent-red/20 text-accent-red'
            }`}>
              {migrationResult.ok
                ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <div>
                <span className="font-bold">{migrationResult.ok ? 'Migration applied:' : 'Migration required:'}</span>{' '}
                {migrationResult.message}
                {!migrationResult.ok && (
                  <p className="mt-1 text-[10px] opacity-80">
                    Open Supabase → SQL Editor → New Query, paste the contents of
                    <code className="mx-1 px-1 bg-black/20 rounded font-mono">migrations/20260614_apply_pending_migrations_fn.sql</code>
                    and click Run. Then click <strong>Fix Schema</strong> again.
                  </p>
                )}
              </div>
            </div>
          )}

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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {/* Card 1: Overall Model Accuracy */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-accent-green opacity-15">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Overall Model Accuracy</span>
                      <h2 className="text-xl font-extrabold text-accent-green mt-1">
                        {accuracyStats.overallModelAccuracy ?? accuracyStats.accuracy}%
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">All verified predictions, before signal filtering</p>
                    </div>

                    {/* Card 2: Tradeable Signal Accuracy */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-accent-blue opacity-15">
                        <Activity className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Tradeable Signal Accuracy</span>
                      <h2 className="text-xl font-extrabold text-text-primary mt-1">
                        {accuracyStats.tradeableAccuracy ?? accuracyStats.accuracy}%
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">
                        Counts only `MODERATE_SIGNAL` and `STRONG_SIGNAL`
                      </p>
                    </div>

                    {/* Card 3: Filtered Predictions */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-premium-gold opacity-15">
                        <ShieldCheck className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Filtered Predictions</span>
                      <h2 className="text-xl font-extrabold text-premium-gold mt-1">
                        {accuracyStats.filteredPredictionsCount ?? 0}
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">Removed from tradeable accuracy calculations</p>
                    </div>

                    {/* Card 4: No Signal Count */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-accent-red opacity-15">
                        <Percent className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">No Signal Count</span>
                      <h2 className="text-xl font-extrabold mt-1 text-accent-red">
                        {accuracyStats.noSignalCount ?? 0}
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">Signals downgraded to `NO_SIGNAL`</p>
                    </div>

                    {/* Card 5: Win / Loss Ratio After Filtering */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-text-muted opacity-15">
                        <BarChart3 className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Win / Loss Ratio After Filtering</span>
                      <h2 className="text-xl font-extrabold text-text-primary mt-1">
                        {accuracyStats.winLossRatioAfterFiltering ?? accuracyStats.winLossRatio}
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">Tradeable signals only</p>
                    </div>

                    {/* Card 6: Median Error Before */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-text-muted opacity-15">
                        <Percent className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Median Error Before</span>
                      <h2 className="text-xl font-extrabold text-premium-gold mt-1">
                        {accuracyStats.medianError}%
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">All verified predictions</p>
                    </div>

                    {/* Card 7: Median Error After */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-accent-green opacity-15">
                        <ShieldCheck className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Median Error After</span>
                      <h2 className="text-xl font-extrabold text-accent-green mt-1">
                        {(accuracyStats.medianErrorAfterFiltering ?? accuracyStats.medianError)}%
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">Tradeable signals only</p>
                    </div>

                    {/* Card 8: Target Status */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Brier Score</span>
                      <h2 className="text-xl font-extrabold text-accent-blue mt-1">
                        {accuracyStats.brierScore === null || accuracyStats.brierScore === undefined
                          ? 'N/A'
                          : accuracyStats.brierScore.toFixed(4)}
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">Lower is better; calibrated directional probabilities</p>
                    </div>

                    {/* Card 9: Target Status */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-premium-gold opacity-15">
                        <AlertCircle className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Target Status</span>
                      <h2 className={`text-xl font-extrabold mt-1 ${accuracyStats.targetAchieved ? 'text-accent-green' : 'text-accent-red'}`}>
                        {accuracyStats.targetAchieved ? 'Achieved' : 'Not Yet'}
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">
                        {accuracyStats.targetAchieved ? 'Tradeable edge meets the target.' : 'Target not achieved yet.'}
                      </p>
                    </div>
                  </div>

                  {/* New Cards Row: Tradeable Signal Count + Calibration Error */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Card 10: Tradeable Signal Count */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-accent-green opacity-15">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Tradeable Signal Count</span>
                      <h2 className="text-xl font-extrabold text-accent-green mt-1">
                        {accuracyStats.tradeableCount ?? accuracyStats.tradeablePredictionsCount ?? 0}
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">Verified predictions meeting all tradeable filters</p>
                    </div>

                    {/* Card 11: Expected Calibration Error (ECE) */}
                    <div className="p-4 bg-bg-card border border-border-custom rounded-xl shadow-xs transition-theme relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 text-accent-blue opacity-15">
                        <Percent className="w-10 h-10" />
                      </div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-text-secondary block">Calibration Error (ECE)</span>
                      <h2 className={`text-xl font-extrabold mt-1 ${
                        accuracyStats.calibrationError == null
                          ? 'text-text-secondary'
                          : accuracyStats.calibrationError < 5
                          ? 'text-accent-green'
                          : accuracyStats.calibrationError < 10
                          ? 'text-accent-yellow'
                          : 'text-accent-red'
                      }`}>
                        {accuracyStats.calibrationError == null
                          ? 'N/A'
                          : `${Number(accuracyStats.calibrationError).toFixed(2)}%`}
                      </h2>
                      <p className="text-[8.5px] text-text-muted mt-1">&lt;5% = well-calibrated; lower is better</p>
                    </div>
                  </div>

                  {!accuracyStats.targetAchieved && (
                    <div className="p-4 bg-accent-red/10 border border-accent-red/20 rounded-xl text-sm text-accent-red font-medium">
                      Target not achieved yet.
                    </div>
                  )}

                  {(accuracyStats.integrityWarnings || []).length > 0 && (
                    <div className="p-4 bg-accent-yellow/10 border border-accent-yellow/25 rounded-xl">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-accent-yellow flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" /> Data Integrity Warnings
                      </h4>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {(accuracyStats.integrityWarnings || []).map((warning: Record<string, any>) => (
                          <div key={warning.code} className="text-[11px] text-text-secondary">
                            <span className="font-bold text-text-primary">{warning.label}:</span> {warning.count} verified records
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Accuracy Trend Chart */}
                    <div className="lg:col-span-8 p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-accent-blue" />
                        Accuracy Trend Over Time (%)
                      </h4>
                      <div className="h-64 w-full">
                        {(accuracyStats.accuracyTrend || []).length === 0 ? (
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

                  {/* Calibration Reliability Curve */}
                  {accuracyStats.reliabilityCurve && accuracyStats.reliabilityCurve.length > 0 && (
                    <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-4">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-accent-blue" />
                          Calibration Reliability Curve
                        </h4>
                        <p className="text-[10px] text-text-secondary mt-1">
                          A well-calibrated model's line should follow the dashed diagonal closely. Points below the diagonal
                          mean the model is over-confident; points above mean it's under-confident.
                        </p>
                      </div>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={(() => {
                              // Build chart data: merge reliability-curve buckets with a perfect-diagonal reference.
                              const curve = (accuracyStats.reliabilityCurve as any[]).map(normalizeCalibrationBucket);
                              return curve.filter((b) => b.sampleSize > 0 && b.actualAccuracy !== null).map((b) => ({
                                label: b.range,
                                predicted: Number(b.expectedAccuracy.toFixed(1)),
                                actual: Number((b.actualAccuracy ?? 0).toFixed(1)),
                                perfect: Number(b.expectedAccuracy.toFixed(1)),
                                samples: b.sampleSize,
                              }));
                            })()}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                              dataKey="predicted"
                              stroke="rgba(255,255,255,0.4)"
                              fontSize={9}
                              label={{ value: 'Predicted Confidence (%)', position: 'insideBottom', offset: -2, fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
                            />
                            <YAxis
                              stroke="rgba(255,255,255,0.4)"
                              fontSize={9}
                              domain={[0, 100]}
                              label={{ value: 'Actual Accuracy (%)', angle: -90, position: 'insideLeft', fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}
                            />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'rgba(20,24,33,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                              labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}
                              formatter={(value: any, name: any) => [
                                `${Number(value).toFixed(1)}%`,
                                name === 'actual' ? 'Observed Accuracy' : name === 'perfect' ? 'Perfect Calibration' : String(name),
                              ]}
                            />
                            {/* Perfect calibration diagonal */}
                            <Line
                              type="linear"
                              dataKey="perfect"
                              stroke="rgba(255,255,255,0.25)"
                              strokeWidth={1.5}
                              strokeDasharray="6 3"
                              dot={false}
                              name="perfect"
                            />
                            {/* Actual calibration curve */}
                            <Line
                              type="monotone"
                              dataKey="actual"
                              stroke="#3b82f6"
                              strokeWidth={2.5}
                              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                              activeDot={{ r: 6 }}
                              name="actual"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Bucket detail table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] text-text-secondary border-collapse">
                          <thead>
                            <tr className="border-b border-border-custom">
                              {['Confidence Range', 'Samples', 'Predicted %', 'Actual %', 'Error', 'Reliability'].map((h) => (
                                <th key={h} className="py-1.5 px-2 text-left font-semibold text-text-primary">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(accuracyStats.reliabilityCurve as any[]).map((b: Record<string, any>) => (
                              <tr key={b.range} className="border-b border-border-custom/50 hover:bg-bg-secondary/40 transition-colors">
                                <td className="py-1.5 px-2 font-mono">{b.range}</td>
                                <td className="py-1.5 px-2">{b.sampleSize}</td>
                                <td className="py-1.5 px-2">{b.predictedConfidence != null ? `${Number(b.predictedConfidence).toFixed(1)}%` : '—'}</td>
                                <td className="py-1.5 px-2">{b.actualAccuracy != null ? `${Number(b.actualAccuracy).toFixed(1)}%` : '—'}</td>
                                <td className={`py-1.5 px-2 font-semibold ${
                                  b.calibrationError == null ? 'text-text-muted'
                                  : b.calibrationError < 5 ? 'text-accent-green'
                                  : b.calibrationError < 10 ? 'text-accent-yellow'
                                  : 'text-accent-red'
                                }`}>{b.calibrationError != null ? `${Number(b.calibrationError).toFixed(1)}%` : '—'}</td>
                                <td className="py-1.5 px-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    b.reliability === 'RELIABLE' ? 'bg-accent-green/15 text-accent-green'
                                    : b.reliability === 'UNRELIABLE' ? 'bg-accent-yellow/15 text-accent-yellow'
                                    : 'bg-text-muted/15 text-text-muted'
                                  }`}>{b.reliability}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}



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
                        const model = (accuracyStats.accuracyByModel || []).find((m: Record<string, any>) => m.modelVersion === version) || {
                          modelVersion: version,
                          total: 0,
                          accuracy: null,
                          medianError: null,
                          correct: 0,
                          incorrect: 0,
                          partial: 0,
                          avgConfidence: 0,
                          calibrationDeviation: null,
                          calibrationRating: 'Insufficient Data'
                        };

                        const focus = version === 'V1' ? 'Balanced Setup' : version === 'V2' ? 'Momentum Heavy' : 'Trend Heavy';
                        const description = version === 'V1' 
                          ? 'Balanced weight allocation across indicators (MA, RSI, MACD, Volume).'
                          : version === 'V2'
                          ? 'Aggressive allocation targeting RSI momentum and MACD histogram crossovers.'
                          : 'Conservative trend allocation emphasizing 200-day moving average and price channels.';

                        const accuracies = (accuracyStats.accuracyByModel || []).map((m: Record<string, any>) => m.accuracy ?? -1);
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
                                <span className="text-xs font-extrabold text-accent-green">{model.accuracy == null ? 'Insufficient Data' : `${model.accuracy.toFixed(1)}%`}</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-text-muted font-bold block">Median Price Error</span>
                                <span className="text-xs font-extrabold text-premium-gold">{model.medianError == null ? 'Insufficient Data' : `${model.medianError.toFixed(2)}%`}</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-text-muted font-bold block">Correct / Incorrect</span>
                                <span className="text-xs font-extrabold text-text-primary">{model.correct} / {model.incorrect}</span>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase text-text-muted font-bold block">Partial</span>
                                <span className="text-xs font-extrabold text-text-primary">{model.partial}</span>
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
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[10px]">
                        <thead><tr className="border-b border-border-custom text-text-secondary"><th>Bucket</th><th>Sample Size</th><th>Expected</th><th>Actual</th><th>Error</th><th>Status</th></tr></thead>
                        <tbody>{(accuracyStats.confidenceCalibration || []).map((bucket: Record<string, any>) => {
                          const normalized = normalizeCalibrationBucket(bucket);
                          return (
                            <tr key={normalized.bucket} className="border-b border-border-custom/30">
                              <td>{normalized.bucket}</td>
                              <td>{normalized.total}</td>
                              <td>{normalized.expectedAccuracy.toFixed(1)}%</td>
                              <td>{normalized.actualAccuracy == null ? 'Insufficient Data' : `${normalized.actualAccuracy.toFixed(1)}%`}</td>
                              <td>{normalized.calibrationError == null ? '—' : `${normalized.calibrationError.toFixed(1)}%`}</td>
                              <td>{normalized.reliability === 'RELIABLE' ? 'Reliable' : normalized.reliability === 'UNRELIABLE' ? 'Unreliable' : 'Insufficient Data'}</td>
                            </tr>
                          );
                        })}</tbody>
                      </table>
                    </div>
                  </div>

                  {/* Reliability Tables */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Stock Reliability */}
                    <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-3">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-text-primary">Stock Reliability</h5>
                      <div className="max-h-60 overflow-y-auto pr-1">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-border-custom text-text-secondary font-bold">
                              <th className="py-2">Ticker</th>
                              <th className="py-2 text-center">Verified</th>
                              <th className="py-2 text-right">Acc.</th>
                              <th className="py-2 text-right">Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-custom/30 text-text-secondary">
                            {(accuracyStats.stockReliability || []).slice(0, 8).map((item: Record<string, any>) => (
                              <tr key={item.label}>
                                <td className="py-2 font-mono font-bold text-text-primary">{item.label}</td>
                                <td className="py-2 text-center">{item.verifiedCount}</td>
                                <td className={`py-2 text-right font-semibold ${(item.accuracy ?? 0) >= 55 ? 'text-accent-green' : 'text-accent-red'}`}>{item.accuracy == null ? 'N/A' : `${item.accuracy.toFixed(1)}%`}</td>
                                <td className="py-2 text-right text-text-muted">{item.reliabilityGrade}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Timeframe Reliability */}
                    <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-3">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-text-primary">Timeframe Reliability</h5>
                      <div className="max-h-60 overflow-y-auto pr-1">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-border-custom text-text-secondary font-bold">
                              <th className="py-2">Frame</th>
                              <th className="py-2 text-center">Verified</th>
                              <th className="py-2 text-right">Acc.</th>
                              <th className="py-2 text-right">WL</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-custom/30 text-text-secondary">
                            {(accuracyStats.timeframeReliability || []).map((item: Record<string, any>) => (
                              <tr key={item.label}>
                                <td className="py-2 text-text-primary font-medium">{item.label}</td>
                                <td className="py-2 text-center">{item.verifiedCount}</td>
                                <td className={`py-2 text-right font-semibold ${(item.accuracy ?? 0) >= 55 ? 'text-accent-green' : 'text-accent-red'}`}>{item.accuracy == null ? 'N/A' : `${item.accuracy.toFixed(1)}%`}</td>
                                <td className="py-2 text-right">{item.winLossRatio == null ? 'N/A' : item.winLossRatio.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Confidence Bucket Performance */}
                    <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-3">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-text-primary">Confidence Bucket Performance</h5>
                      <div className="max-h-60 overflow-y-auto pr-1">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-border-custom text-text-secondary font-bold">
                              <th className="py-2">Bucket</th>
                              <th className="py-2 text-center">Verified</th>
                              <th className="py-2 text-right">Acc.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-custom/30 text-text-secondary">
                            {(accuracyStats.confidenceBucketPerformance || []).map((item: Record<string, any>) => (
                              <tr key={item.label}>
                                <td className="py-2 text-text-primary font-medium">{item.label}</td>
                                <td className="py-2 text-center">{item.verifiedCount}</td>
                                <td className={`py-2 text-right font-semibold ${(item.accuracy ?? 0) >= 55 ? 'text-accent-green' : 'text-accent-red'}`}>{item.accuracy == null ? 'N/A' : `${item.accuracy.toFixed(1)}%`}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-3">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-text-primary">Accuracy by Stock / Sector / Market</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[10px]">
                        <thead><tr className="border-b border-border-custom text-text-secondary"><th>Group</th><th>Value</th><th>Total</th><th>Correct</th><th>Incorrect</th><th>Partial</th><th>Neutral</th><th>No Signal</th><th>Overall Accuracy</th><th>Tradeable Signal Accuracy</th></tr></thead>
                        <tbody>
                          {[
                            ...(accuracyStats.stockReliability || []).map((row: Record<string, any>) => ({ ...row, group: 'Stock', total: row.verifiedCount, correct: row.correctCount, incorrect: row.incorrectCount, partial: row.partialCount, neutral: row.neutralCount, noSignal: row.noSignalCount })),
                            ...(accuracyStats.sectorReliability || []).map((row: Record<string, any>) => ({ ...row, group: 'Sector', total: row.verifiedCount, correct: row.correctCount, incorrect: row.incorrectCount, partial: row.partialCount, neutral: row.neutralCount, noSignal: row.noSignalCount })),
                            ...(accuracyStats.accuracyByMarket || []).map((row: Record<string, any>) => ({ ...row, group: 'Market', label: row.market })),
                          ].map((row: Record<string, any>) => (
                            <tr key={`${row.group}-${row.label}`} className="border-b border-border-custom/30 text-text-secondary">
                              <td>{row.group}</td><td className="font-bold text-text-primary">{row.label}</td><td>{row.total}</td><td>{row.correct}</td><td>{row.incorrect}</td><td>{row.partial}</td><td>{row.neutral}</td><td>{row.noSignal}</td>
                              <td>{row.accuracy == null ? 'Insufficient Data' : `${row.accuracy.toFixed(1)}%`}</td>
                              <td>{row.tradeableAccuracy == null ? 'Insufficient Data' : `${row.tradeableAccuracy.toFixed(1)}%`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Failure Analysis */}
                  <div className="p-5 border border-border-custom bg-bg-card rounded-xl shadow-sm space-y-4">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-text-primary">Failure Analysis Table</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-border-custom text-text-secondary font-bold">
                            <th className="py-2">Dimension</th>
                            <th className="py-2">Value</th>
                            <th className="py-2 text-center">Failures</th>
                            <th className="py-2 text-center">Verified</th>
                            <th className="py-2 text-right">Acc.</th>
                            <th className="py-2 text-right">WL</th>
                            <th className="py-2 text-right">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-custom/30 text-text-secondary">
                          {(accuracyStats.failureAnalysis || []).slice(0, 20).map((item: Record<string, any>) => (
                            <tr key={`${item.dimension}-${item.label}`}>
                              <td className="py-2 uppercase text-text-muted">{item.dimension}</td>
                              <td className="py-2 text-text-primary font-medium">{item.label}</td>
                              <td className="py-2 text-center text-accent-red font-semibold">{item.failures}</td>
                              <td className="py-2 text-center">{item.verifiedCount}</td>
                              <td className={`py-2 text-right font-semibold ${(item.accuracy ?? 0) >= 55 ? 'text-accent-green' : 'text-accent-red'}`}>{item.accuracy == null ? 'N/A' : `${item.accuracy.toFixed(1)}%`}</td>
                              <td className="py-2 text-right">{item.winLossRatio == null ? 'N/A' : item.winLossRatio.toFixed(2)}</td>
                              <td className="py-2 text-right text-text-muted">{item.reliabilityGrade}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                                <th className="py-2 text-right">Contribution</th>
                                <th className="py-2 text-right">Samples</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-custom/30 text-text-secondary">
                              {indicatorPerformance?.rankings && indicatorPerformance.rankings.length > 0 ? (
                                indicatorPerformance.rankings.map((ind: Record<string, any>) => {
                                  const diff = ind.current_weight - ind.previous_weight;
                                  return (
                                    <tr key={ind.indicator_name} className="hover:bg-bg-secondary/20">
                                      <td className="py-2.5 font-semibold text-text-primary uppercase">{ind.indicator_name}</td>
                                      <td className="py-2.5 text-center font-mono font-bold text-text-primary">
                                        {ind.data_status === 'INSUFFICIENT_VERIFIED_DATA' ? 'Insufficient verified data' : ind.current_weight}
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
                                        (ind.accuracy_score ?? 0) >= 55 
                                          ? 'text-accent-green' 
                                          : (ind.accuracy_score ?? 0) >= 50 
                                          ? 'text-accent-yellow' 
                                          : 'text-accent-red'
                                      }`}>
                                        {ind.total_activations === 0 || ind.accuracy_score == null ? 'Insufficient verified data' : `${ind.accuracy_score.toFixed(1)}%`}
                                      </td>
                                      <td className="py-2.5 text-right font-mono">{ind.contribution_score == null ? 'N/A' : ind.contribution_score.toFixed(1)}</td>
                                      <td className="py-2.5 text-right font-mono">{ind.total_activations}</td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan={7} className="py-8 text-center text-text-muted">
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
                                data={indicatorPerformance.history.map((snap: Record<string, any>, idx: number) => ({
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
                            <span className="text-[10px] font-mono text-text-muted">verified as of {new Date(regimeStats.currentRegime.asOf).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                        {regimeStats?.regimes && regimeStats.regimes.length > 0 ? (
                          regimeStats.regimes.map((reg: Record<string, any>) => (
                            <div key={reg.regime} className="p-4 bg-bg-secondary/35 border border-border-custom/80 rounded-xl relative overflow-hidden">
                              <span className="text-[8.5px] uppercase font-bold text-text-muted tracking-wider block leading-snug">
                                {reg.label}
                              </span>
                              <div className="flex items-baseline gap-1 mt-2">
                                <h3 className={`text-lg font-extrabold ${
                                  reg.accuracy_score != null && reg.accuracy_score >= 55
                                    ? 'text-accent-green' 
                                    : reg.accuracy_score != null && reg.accuracy_score >= 50
                                    ? 'text-accent-yellow' 
                                    : 'text-accent-red'
                                }`}>
                                  {reg.accuracy_score == null ? 'No verified data' : `${reg.accuracy_score.toFixed(1)}%`}
                                </h3>
                                <span className="text-[9px] text-text-muted">wins</span>
                              </div>
                              <div className="mt-2 flex items-center justify-between text-[9px] text-text-secondary border-t border-border-custom/40 pt-2 font-mono">
                                <span>Forecasts:</span>
                                <span className="font-bold text-text-primary">{reg.total_predictions}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[9px] text-text-secondary font-mono">
                                <span>Avg Error:</span>
                                <span className="font-bold text-premium-gold">{reg.avg_error_percentage == null ? 'No verified data' : `${reg.avg_error_percentage.toFixed(2)}%`}</span>
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

    </>
  );
}
