// ─── Walk-Forward Testing Engine ─────────────────────────────────────────────

import { WalkForwardConfig, WalkForwardWindow, WalkForwardResult, WalkForwardWindowResult, BacktestPredictionRecord } from './types';
import { computeAccuracyReport } from './accuracy-analytics';

/**
 * Generates non-overlapping walk-forward windows.
 *
 * Example:
 *   trainYears=10, validateMonths=24, testMonths=12, stepMonths=12
 *   Window 1: Train 2000–2010, Validate 2010–2012, Test 2012–2013
 *   Window 2: Train 2001–2011, Validate 2011–2013, Test 2013–2014
 *   ...
 */
export function generateWalkForwardWindows(
  dataStartDate: string,
  dataEndDate: string,
  config: WalkForwardConfig
): WalkForwardWindow[] {
  const windows: WalkForwardWindow[] = [];

  const dataStart = new Date(dataStartDate);
  const dataEnd = new Date(dataEndDate);

  const trainMs = config.trainYears * 365.25 * 24 * 3600 * 1000;
  const validateMs = config.validateMonths * 30.44 * 24 * 3600 * 1000;
  const testMs = config.testMonths * 30.44 * 24 * 3600 * 1000;
  const stepMs = config.stepMonths * 30.44 * 24 * 3600 * 1000;

  let trainStart = dataStart.getTime();
  let index = 0;

  while (true) {
    const trainEnd = trainStart + trainMs;
    const validateStart = trainEnd;
    const validateEnd = validateStart + validateMs;
    const testStart = validateEnd;
    const testEnd = testStart + testMs;

    // Stop if test period exceeds available data
    if (testEnd > dataEnd.getTime()) break;

    windows.push({
      index: index++,
      trainStart: toDateStr(trainStart),
      trainEnd: toDateStr(trainEnd),
      validateStart: toDateStr(validateStart),
      validateEnd: toDateStr(validateEnd),
      testStart: toDateStr(testStart),
      testEnd: toDateStr(testEnd),
    });

    trainStart += stepMs;
  }

  return windows;
}

/**
 * Aggregates walk-forward window results into a summary.
 */
export function aggregateWalkForwardResults(windowResults: WalkForwardWindowResult[]): WalkForwardResult {
  if (windowResults.length === 0) {
    return {
      windows: [],
      aggregateTestAccuracy: 0,
      overfitScore: 0,
      bestWindow: 0,
      worstWindow: 0,
    };
  }

  const testAccuracies = windowResults.map(w => w.testAccuracy);
  const trainAccuracies = windowResults.map(w => w.trainAccuracy);

  const aggregateTestAccuracy = mean(testAccuracies);
  const avgTrainAccuracy = mean(trainAccuracies);
  const overfitScore = round(avgTrainAccuracy - aggregateTestAccuracy);

  const bestWindow = windowResults.reduce((best, w, i) =>
    w.testAccuracy > windowResults[best].testAccuracy ? i : best, 0);
  const worstWindow = windowResults.reduce((worst, w, i) =>
    w.testAccuracy < windowResults[worst].testAccuracy ? i : worst, 0);

  return {
    windows: windowResults,
    aggregateTestAccuracy: round(aggregateTestAccuracy),
    overfitScore,
    bestWindow,
    worstWindow,
  };
}

/**
 * Computes performance stats for a slice of prediction records.
 */
export function computeWindowStats(records: BacktestPredictionRecord[]): {
  accuracy: number;
  sharpe: number;
  predictions: number;
} {
  if (records.length === 0) return { accuracy: 0, sharpe: 0, predictions: 0 };
  const report = computeAccuracyReport(records);
  return {
    accuracy: report.accuracy,
    sharpe: report.sharpeRatio,
    predictions: report.totalPredictions,
  };
}

/**
 * Filters prediction records to a specific date window.
 */
export function filterRecordsByWindow(
  records: BacktestPredictionRecord[],
  startDate: string,
  endDate: string
): BacktestPredictionRecord[] {
  return records.filter(r => r.date >= startDate && r.date <= endDate);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function toDateStr(ts: number): string {
  return new Date(ts).toISOString().split('T')[0];
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round(val: number): number {
  return Math.round(val * 100) / 100;
}
