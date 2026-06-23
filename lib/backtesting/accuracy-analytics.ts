/* eslint-disable @typescript-eslint/no-unused-vars */
// ─── Accuracy Analytics Engine ────────────────────────────────────────────────

import {
  BacktestPredictionRecord,
  TickerBacktestResult,
  AccuracyReport,
  CalibrationBucket,
  EquityPoint,
  DrawdownPoint,
  RegimeStats,
  MarketRegime,
} from './types';

const RISK_FREE_RATE_DAILY = 0.05 / 252; // 5% annualized

function classifySignalStrength(confidence: number): 'NO_SIGNAL' | 'WEAK_SIGNAL' | 'MODERATE_SIGNAL' | 'STRONG_SIGNAL' {
  if (confidence < 55) return 'NO_SIGNAL';
  if (confidence < 65) return 'WEAK_SIGNAL';
  if (confidence < 75) return 'MODERATE_SIGNAL';
  return 'STRONG_SIGNAL';
}

function isTradeable(record: BacktestPredictionRecord): boolean {
  const signal = record.signalStrength ?? classifySignalStrength(record.confidence);
  return signal === 'MODERATE_SIGNAL' || signal === 'STRONG_SIGNAL';
}

// ─── Core Metric Computation ──────────────────────────────────────────────────

export function computeAccuracyReport(records: BacktestPredictionRecord[]): AccuracyReport {
  const directional = records.filter(r => r.direction !== 'NEUTRAL');
  const verified = records.filter(r => r.result !== 'PENDING');
  const tradeable = verified.filter(isTradeable);
  const correct = verified.filter(r => r.result === 'CORRECT');
  const incorrect = verified.filter(r => r.result === 'INCORRECT');
  const partial = verified.filter(r => r.result === 'PARTIALLY_CORRECT');
  const tradeableCorrect = tradeable.filter(r => r.result === 'CORRECT');
  const tradeableIncorrect = tradeable.filter(r => r.result === 'INCORRECT');
  const tradeablePartial = tradeable.filter(r => r.result === 'PARTIALLY_CORRECT');

  const totalPredictions = records.length;
  const verifiedPredictions = verified.length;

  // Core accuracy
  const accuracy = verifiedPredictions > 0
    ? ((correct.length + partial.length * 0.5) / verifiedPredictions) * 100
    : 0;
  const tradeableAccuracy = tradeable.length > 0
    ? ((tradeableCorrect.length + tradeablePartial.length * 0.5) / tradeable.length) * 100
    : 0;

  const winRate = (correct.length + incorrect.length) > 0
    ? (correct.length / (correct.length + incorrect.length)) * 100
    : 0;
  const tradeableWinLoss = tradeableIncorrect.length > 0
    ? tradeableCorrect.length / tradeableIncorrect.length
    : (tradeableCorrect.length > 0 ? tradeableCorrect.length : 0);

  // Precision, Recall, F1
  const tp = correct.length;
  const fp = incorrect.filter(r => r.direction === 'UP').length;
  const fn = incorrect.filter(r => r.direction === 'DOWN').length;

  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const f1Score = (precision + recall) > 0
    ? (2 * precision * recall) / (precision + recall)
    : 0;

  // Error metrics
  const errors = verified.map(r => Math.abs(r.predictedReturn - r.actualReturn));
  const tradeableErrors = tradeable.map(r => Math.abs(r.predictedReturn - r.actualReturn));
  const averageError = mean(errors);
  const medianError = median(errors);
  const tradeableMedianError = median(tradeableErrors);

  // Equity curve and drawdown
  const { equityCurve, drawdownCurve, maxDrawdown } = buildEquityCurve(records);

  // Sharpe ratio
  const returns = records.map(r => r.actualReturn / 100);
  const avgReturn = mean(returns);
  const returnStd = stdDev(returns);
  const sharpeRatio = returnStd > 0
    ? ((avgReturn - RISK_FREE_RATE_DAILY) / returnStd) * Math.sqrt(252)
    : 0;

  // Sortino ratio (downside only)
  const downside = returns.filter(r => r < 0);
  const downsideStd = stdDev(downside);
  const sortinorRatio = downsideStd > 0
    ? ((avgReturn - RISK_FREE_RATE_DAILY) / downsideStd) * Math.sqrt(252)
    : 0;

  // Confidence calibration
  const calibrationBuckets = computeCalibrationBuckets(records);
  const confidenceCalibrationError = mean(calibrationBuckets.map(b => b.calibrationError));

  return {
    totalPredictions,
    verifiedPredictions,
    accuracy: round(accuracy),
    winRate: round(winRate),
    lossRate: round(100 - winRate),
    precision: round(precision * 100),
    recall: round(recall * 100),
    f1Score: round(f1Score * 100),
    averageError: round(averageError),
    medianError: round(medianError),
    maxDrawdown: round(maxDrawdown),
    sharpeRatio: round(sharpeRatio),
    sortinorRatio: round(sortinorRatio),
    confidenceCalibrationError: round(confidenceCalibrationError * 100),
    calibrationBuckets,
    equityCurve,
    drawdownCurve,
    beforeFiltering: {
      accuracy: round(accuracy),
      winLossRatio: round(correct.length / Math.max(1, incorrect.length)),
      medianError: round(medianError),
      predictionCount: verifiedPredictions,
    },
    afterFiltering: {
      tradeableAccuracy: round(tradeableAccuracy),
      winLossRatio: round(tradeableWinLoss),
      medianError: round(tradeableMedianError),
      filteredPredictionCount: tradeable.length,
      noSignalCount: verified.filter(r => (r.signalStrength ?? classifySignalStrength(r.confidence)) === 'NO_SIGNAL').length,
    },
  };
}

// ─── Per-Ticker Stats ─────────────────────────────────────────────────────────

export function computeTickerStats(
  ticker: string,
  sector: string,
  records: BacktestPredictionRecord[]
): TickerBacktestResult {
  const base = computeAccuracyReport(records);

  const verified = records.filter(r => r.result !== 'PENDING');
  const correct = verified.filter(r => r.result === 'CORRECT');
  const incorrect = verified.filter(r => r.result === 'INCORRECT');
  const partial = verified.filter(r => r.result === 'PARTIALLY_CORRECT');
  const neutral = records.filter(r => r.direction === 'NEUTRAL');

  // Regime breakdown
  const regimes: MarketRegime[] = ['BULL', 'BEAR', 'SIDEWAYS', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'TRENDING', 'MEAN_REVERTING'];
  const regimeBreakdown = {} as Record<MarketRegime, RegimeStats>;
  for (const regime of regimes) {
    const regimeRecords = verified.filter(r => r.regime === regime);
    const regimeCorrect = regimeRecords.filter(r => r.result === 'CORRECT' || r.result === 'PARTIALLY_CORRECT');
    const regimeReturns = regimeRecords.map(r => r.actualReturn);
    regimeBreakdown[regime] = {
      count: regimeRecords.length,
      accuracy: regimeRecords.length > 0 ? (regimeCorrect.length / regimeRecords.length) * 100 : 0,
      avgReturn: mean(regimeReturns),
    };
  }

  // Calmar ratio
  const annualReturn = mean(records.map(r => r.actualReturn)) * 252;
  const calmarRatio = base.maxDrawdown > 0 ? annualReturn / Math.abs(base.maxDrawdown) : 0;

  return {
    ticker,
    sector,
    totalPredictions: records.length,
    verifiedPredictions: base.verifiedPredictions,
    correctCount: correct.length,
    incorrectCount: incorrect.length,
    partialCount: partial.length,
    neutralCount: neutral.length,
    accuracy: base.accuracy,
    winRate: base.winRate,
    lossRate: base.lossRate,
    precision: base.precision,
    recall: base.recall,
    f1Score: base.f1Score,
    averageError: base.averageError,
    medianError: base.medianError,
    maxDrawdown: base.maxDrawdown,
    sharpeRatio: base.sharpeRatio,
    sortinorRatio: base.sortinorRatio,
    calmarRatio: round(calmarRatio),
    confidenceCalibrationError: base.confidenceCalibrationError,
    regimeBreakdown,
    timeframeBreakdown: {},
    records,
  };
}

// ─── Confidence Calibration ───────────────────────────────────────────────────

function computeCalibrationBuckets(records: BacktestPredictionRecord[]): CalibrationBucket[] {
  const buckets: CalibrationBucket[] = [];
  const ranges = [
    [50, 60], [60, 70], [70, 80], [80, 90], [90, 100],
  ];

  for (const [low, high] of ranges) {
    const inBucket = records.filter(
      r => r.confidence >= low && r.confidence < high && r.result !== 'PENDING'
    );
    const correct = inBucket.filter(r => r.result === 'CORRECT' || r.result === 'PARTIALLY_CORRECT');
    const actualAccuracy = inBucket.length > 0 ? (correct.length / inBucket.length) * 100 : 0;
    const predictedProbability = (low + high) / 2;
    const calibrationError = Math.abs(predictedProbability - actualAccuracy) / 100;

    buckets.push({
      confidenceRange: `${low}-${high}`,
      predictedProbability,
      actualAccuracy: round(actualAccuracy),
      count: inBucket.length,
      calibrationError: round(calibrationError * 100),
    });
  }

  return buckets;
}

// ─── Equity Curve ─────────────────────────────────────────────────────────────

function buildEquityCurve(records: BacktestPredictionRecord[]): {
  equityCurve: EquityPoint[];
  drawdownCurve: DrawdownPoint[];
  maxDrawdown: number;
} {
  // Sort by date
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

  let equity = 100;
  let peak = 100;
  let maxDrawdown = 0;
  const equityCurve: EquityPoint[] = [];
  const drawdownCurve: DrawdownPoint[] = [];

  for (const record of sorted) {
    if (record.result === 'PENDING') continue;
    // Apply return based on correctness
    let returnApplied = 0;
    if (record.result === 'CORRECT') {
      returnApplied = Math.abs(record.actualReturn);
    } else if (record.result === 'PARTIALLY_CORRECT') {
      returnApplied = Math.abs(record.actualReturn) * 0.5;
    } else if (record.result === 'INCORRECT') {
      returnApplied = -Math.abs(record.actualReturn);
    }

    equity *= (1 + returnApplied / 100);
    peak = Math.max(peak, equity);
    const drawdown = ((equity - peak) / peak) * 100;
    maxDrawdown = Math.min(maxDrawdown, drawdown);

    equityCurve.push({ date: record.date, equity: round(equity), drawdown: round(drawdown) });
    drawdownCurve.push({ date: record.date, drawdown: round(drawdown), underwater: drawdown < -1 });
  }

  return { equityCurve, drawdownCurve, maxDrawdown: round(Math.abs(maxDrawdown)) };
}

// ─── Regime Performance Summary ───────────────────────────────────────────────

export function getBestRegime(regimeBreakdown: Record<MarketRegime, RegimeStats>): MarketRegime {
  const regimes = Object.entries(regimeBreakdown) as [MarketRegime, RegimeStats][];
  const withData = regimes.filter(([, s]) => s.count >= 5);
  if (withData.length === 0) return 'BULL';
  return withData.sort((a, b) => b[1].accuracy - a[1].accuracy)[0][0];
}

export function getWorstRegime(regimeBreakdown: Record<MarketRegime, RegimeStats>): MarketRegime {
  const regimes = Object.entries(regimeBreakdown) as [MarketRegime, RegimeStats][];
  const withData = regimes.filter(([, s]) => s.count >= 5);
  if (withData.length === 0) return 'BEAR';
  return withData.sort((a, b) => a[1].accuracy - b[1].accuracy)[0][0];
}

// ─── Aggregation Utilities ────────────────────────────────────────────────────

export function aggregateTickerResults(results: TickerBacktestResult[]): AccuracyReport {
  const allRecords = results.flatMap(r => r.records);
  return computeAccuracyReport(allRecords);
}

export function computeSectorAccuracy(results: TickerBacktestResult[]): { sector: string; accuracy: number; winRate: number; tickerCount: number }[] {
  const bySector = new Map<string, TickerBacktestResult[]>();
  for (const r of results) {
    const arr = bySector.get(r.sector) ?? [];
    arr.push(r);
    bySector.set(r.sector, arr);
  }

  return Array.from(bySector.entries()).map(([sector, items]) => ({
    sector,
    accuracy: round(mean(items.map(i => i.accuracy))),
    winRate: round(mean(items.map(i => i.winRate))),
    tickerCount: items.length,
  })).sort((a, b) => b.accuracy - a.accuracy);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(arr: number[]): number {
  if (arr.length === 0) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

function round(val: number): number {
  return Math.round(val * 100) / 100;
}
