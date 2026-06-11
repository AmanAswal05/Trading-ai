// ─── Model Comparator ─────────────────────────────────────────────────────────

import {
  BacktestModel,
  BacktestPredictionRecord,
  ModelComparisonRow,
  MarketRegime,
  RegimeStats,
} from './types';
import { computeAccuracyReport, getBestRegime, getWorstRegime } from './accuracy-analytics';

export const MODEL_NAMES: Record<BacktestModel, string> = {
  V1: 'Current Model (Baseline)',
  V2: 'Adaptive Weight Model',
  V3: 'Trend Regime Model',
  REGIME: 'Regime Detection Model',
  META: 'Meta Ensemble Model',
  ALL: 'All Models Combined',
};

// ─── Model Ranking ────────────────────────────────────────────────────────────

/**
 * Compares all models on the same dataset and returns a ranked leaderboard.
 * Composite score: 40% Accuracy + 20% Sharpe + 20% F1 + 10% -MaxDrawdown + 10% -CalibrationError
 */
export function rankModels(
  allRecords: BacktestPredictionRecord[]
): ModelComparisonRow[] {
  const models: BacktestModel[] = ['V1', 'V2', 'V3', 'REGIME', 'META'];
  const rows: ModelComparisonRow[] = [];

  for (const model of models) {
    const modelRecords = allRecords.filter(r => r.model === model);
    if (modelRecords.length === 0) {
      // Create empty row if no records for this model
      rows.push(createEmptyRow(model));
      continue;
    }

    const report = computeAccuracyReport(modelRecords);

    // Regime breakdown for best/worst
    const regimes: MarketRegime[] = ['BULL', 'BEAR', 'SIDEWAYS', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'TRENDING', 'MEAN_REVERTING'];
    const regimeBreakdown = {} as Record<MarketRegime, RegimeStats>;
    for (const regime of regimes) {
      const regimeRecs = modelRecords.filter(r => r.regime === regime && r.result !== 'PENDING');
      const regimeCorrect = regimeRecs.filter(r => r.result === 'CORRECT' || r.result === 'PARTIALLY_CORRECT');
      regimeBreakdown[regime] = {
        count: regimeRecs.length,
        accuracy: regimeRecs.length > 0 ? (regimeCorrect.length / regimeRecs.length) * 100 : 0,
        avgReturn: 0,
      };
    }

    rows.push({
      model,
      modelName: MODEL_NAMES[model],
      rank: 0, // will be set below
      compositeScore: 0, // will be computed below
      accuracy: report.accuracy,
      winRate: report.winRate,
      precision: report.precision,
      recall: report.recall,
      f1Score: report.f1Score,
      sharpeRatio: report.sharpeRatio,
      maxDrawdown: report.maxDrawdown,
      confidenceCalibrationError: report.confidenceCalibrationError,
      totalPredictions: report.totalPredictions,
      bestRegime: getBestRegime(regimeBreakdown),
      worstRegime: getWorstRegime(regimeBreakdown),
    });
  }

  // Compute composite scores and rank
  return assignRanks(rows);
}

// ─── Composite Scoring ────────────────────────────────────────────────────────

function assignRanks(rows: ModelComparisonRow[]): ModelComparisonRow[] {
  if (rows.length === 0) return rows;

  // Normalize each metric to 0-100 scale across models
  const accuracies = rows.map(r => r.accuracy);
  const sharpes = rows.map(r => r.sharpeRatio);
  const f1s = rows.map(r => r.f1Score);
  const drawdowns = rows.map(r => r.maxDrawdown); // lower is better
  const calErrors = rows.map(r => r.confidenceCalibrationError); // lower is better

  const scored = rows.map((row, i) => {
    const normAccuracy = normalize(row.accuracy, accuracies);
    const normSharpe = normalize(row.sharpeRatio, sharpes);
    const normF1 = normalize(row.f1Score, f1s);
    const normDrawdown = 100 - normalize(row.maxDrawdown, drawdowns); // invert (lower = better)
    const normCalError = 100 - normalize(row.confidenceCalibrationError, calErrors); // invert

    const compositeScore = round(
      normAccuracy * 0.40 +
      normSharpe * 0.20 +
      normF1 * 0.20 +
      normDrawdown * 0.10 +
      normCalError * 0.10
    );

    return { ...row, compositeScore };
  });

  // Sort by composite score descending
  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  // Assign ranks
  return scored.map((row, i) => ({ ...row, rank: i + 1 }));
}

function normalize(value: number, allValues: number[]): number {
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  if (max === min) return 50;
  return ((value - min) / (max - min)) * 100;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createEmptyRow(model: BacktestModel): ModelComparisonRow {
  return {
    model,
    modelName: MODEL_NAMES[model],
    rank: 99,
    compositeScore: 0,
    accuracy: 0,
    winRate: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    confidenceCalibrationError: 0,
    totalPredictions: 0,
    bestRegime: 'BULL',
    worstRegime: 'BEAR',
  };
}

function round(val: number): number {
  return Math.round(val * 100) / 100;
}
