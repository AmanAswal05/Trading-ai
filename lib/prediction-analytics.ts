import type { PredictionRecord } from './predictions-db';
import type { SignalStrength } from '../types/stock';

export type ReliabilityGrade = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';

export interface PredictionReliabilityRow {
  label: string;
  verifiedCount: number;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  neutralCount: number;
  noSignalCount: number;
  accuracy: number;
  tradeableAccuracy: number;
  tradeableCount: number;
  winLossRatio: number;
  medianError: number;
  reliabilityGrade: ReliabilityGrade;
  warning: string;
}

export interface FailureAnalysisRow extends PredictionReliabilityRow {
  dimension: 'ticker' | 'sector' | 'timeframe' | 'market_regime' | 'confidence_bucket' | 'volatility_level' | 'indicator_setup';
  failures: number;
  failureRate: number;
}

export interface PredictionAnalyticsSummary {
  overallAccuracy: number;
  tradeableAccuracy: number;
  accuracyBeforeFiltering: number;
  accuracyAfterFiltering: number;
  overallWinLossRatio: number;
  winLossRatioAfterFiltering: number;
  medianError: number;
  medianErrorAfterFiltering: number;
  totalVerified: number;
  filteredPredictionsCount: number;
  filterBreakdown: Record<string, number>;
  noSignalCount: number;
  weakSignalCount: number;
  modSignalCount: number;
  strongSignalCount: number;
  tradeablePredictionsCount: number;
  targetAchieved: boolean;
}

export interface PredictionAnalyticsReport extends PredictionAnalyticsSummary {
  stockReliability: PredictionReliabilityRow[];
  sectorReliability: PredictionReliabilityRow[];
  timeframeReliability: PredictionReliabilityRow[];
  trendRegimeReliability: PredictionReliabilityRow[];
  volatilityRegimeReliability: PredictionReliabilityRow[];
  combinedRegimeReliability: PredictionReliabilityRow[];
  confidenceBucketPerformance: PredictionReliabilityRow[];
  failureAnalysis: FailureAnalysisRow[];
}

export interface ReliabilityContext {
  ticker: string;
  timeframe: string;
  currentConfidence: number;
  currentPrice: number;
  predictedPrice: number;
  explanation?: {
    trend_contribution?: number;
    volume_contribution?: number;
    volatility_contribution?: number;
    rsi_contribution?: number;
    macd_contribution?: number;
    sentiment_contribution?: number;
    support_resistance_contribution?: number;
    ai_reasoning_summary?: string;
  };
  regime?: string;
}

export interface ReliabilityDecision {
  confidence: number;
  signalStrength: SignalStrength;
  reliabilityGrade: ReliabilityGrade;
  warnings: string[];
  breakdown: {
    ticker: PredictionReliabilityRow;
    sector: PredictionReliabilityRow;
    timeframe: PredictionReliabilityRow;
    regime: PredictionReliabilityRow;
    volatility: PredictionReliabilityRow;
    setup: PredictionReliabilityRow;
  };
}

const MIN_HIGH_SAMPLE = 30;
const MIN_MEDIUM_SAMPLE = 15;
const MIN_LOW_SAMPLE = 10;

export function classifySignalStrength(confidence: number): SignalStrength {
  if (confidence < 55) return 'NO_SIGNAL';
  if (confidence < 65) return 'WEAK_SIGNAL';
  if (confidence < 75) return 'MODERATE_SIGNAL';
  return 'STRONG_SIGNAL';
}

export function isTradeableSignal(signal?: SignalStrength): boolean {
  return signal === 'MODERATE_SIGNAL' || signal === 'STRONG_SIGNAL';
}

export type FilterReason = 
  | 'BELOW_MIN_CONFIDENCE'
  | 'HIGH_RISK_SCORE'
  | 'HIGH_VOLATILITY'
  | 'LOW_DATA_QUALITY'
  | 'MISSING_ACTUAL_PRICE'
  | 'MISSING_PREDICTED_PRICE'
  | 'INVALID_CONFIDENCE'
  | 'INVALID_PROBABILITY'
  | 'INVALID_DIRECTION'
  | 'EXPIRED_PREDICTION'
  | 'DUPLICATE_PREDICTION'
  | 'DATABASE_MISMATCH'
  | 'UNKNOWN_REASON'
  | null;

export function getFilterReason(record: PredictionRecord): FilterReason {
  if (record.actual_price === undefined || record.actual_price === null) return 'MISSING_ACTUAL_PRICE';
  if (record.predicted_price === undefined || record.predicted_price === null) return 'MISSING_PREDICTED_PRICE';
  
  if (typeof record.confidence_score !== 'number' || record.confidence_score < 0 || record.confidence_score > 100 || isNaN(record.confidence_score)) return 'INVALID_CONFIDENCE';
  if (record.calibrated_prob_up !== undefined && record.calibrated_prob_up !== null && (record.calibrated_prob_up < 0 || record.calibrated_prob_up > 1)) return 'INVALID_PROBABILITY';
  if (!['UP', 'DOWN', 'NEUTRAL'].includes(record.predicted_direction)) return 'INVALID_DIRECTION';
  if (!['UP', 'DOWN', 'NEUTRAL'].includes(record.actual_direction || '')) return 'INVALID_DIRECTION';
  
  if (record.metrics?.risk_score && record.metrics.risk_score >= 8) return 'HIGH_RISK_SCORE';
  
  const movePct = record.current_price > 0
    ? Math.abs((record.predicted_price - record.current_price) / record.current_price) * 100
    : 0;
  if (movePct >= 12) return 'HIGH_VOLATILITY';
  
  if (record.confidence_score < 40) return 'BELOW_MIN_CONFIDENCE';
  if (record.reliability_grade === 'INSUFFICIENT_DATA') return 'LOW_DATA_QUALITY';
  if (record.status === 'VERIFIED' && !record.verification_date) return 'DATABASE_MISMATCH';
  
  return null;
}

export function isTradeableRecord(record: PredictionRecord): boolean {
  if (typeof record.is_tradeable_signal === 'boolean') return record.is_tradeable_signal;
  const tf = record.timeframe;
  if (tf === '1D') return false;
  
  const confidence = record.calibrated_prob_up !== undefined && record.calibrated_prob_up !== null
    ? Math.max(record.calibrated_prob_up, 1 - record.calibrated_prob_up) * 100
    : Math.max(record.confidence_score, 100 - record.confidence_score);
    
  if (confidence < 60) return false;
  return isTradeableSignal(record.signal_strength ?? classifySignalStrength(confidence));
}

export function calculateMaxPositionSize(record: PredictionRecord, breakdown?: any): number {
  if (!isTradeableRecord(record)) return 0.0;
  let poorEdge = false;
  if (breakdown && breakdown.ticker) {
    const tickerAcc = breakdown.ticker.accuracy;
    if (typeof tickerAcc === 'number' && tickerAcc < 55) {
      poorEdge = true;
    }
  }

  // Without edge, positions are highly throttled or skipped entirely
  return poorEdge ? 0.25 : 1.0;
}

export function getConfidenceBucketLabel(confidence: number): string {
  if (confidence < 55) return 'NO_SIGNAL';
  if (confidence < 65) return 'WEAK_SIGNAL';
  if (confidence < 75) return 'MODERATE_SIGNAL';
  return 'STRONG_SIGNAL';
}

export function deriveMarketRegime(record: PredictionRecord): string {
  if (record.regime) return record.regime;
  const summary = record.explanation?.ai_reasoning_summary || '';
  const match = summary.match(/\b(BULL|BEAR|SIDEWAYS|HIGH_VOLATILITY|LOW_VOLATILITY|TRENDING|MEAN_REVERTING)\b/);
  if (match) return match[1];
  return 'UNKNOWN';
}

function getSector(ticker: string): string {
  const symbol = ticker.toUpperCase();
  if (symbol.startsWith('AAPL') || symbol.startsWith('MSFT')) return 'Technology';
  if (symbol.startsWith('GOOGL') || symbol.startsWith('META')) return 'Communication';
  if (symbol.startsWith('AMZN') || symbol.startsWith('TSLA')) return 'Consumer Cyclical';
  if (symbol.includes('RELIANCE') || symbol.includes('ONGC')) return 'Energy';
  if (symbol.includes('NIFTY') || symbol.includes('SENSEX') || symbol.includes('SPY')) return 'Index';
  return 'Financial Services';
}

export function deriveVolatilityLevel(record: PredictionRecord): string {
  const movePct = record.current_price > 0
    ? Math.abs((record.predicted_price - record.current_price) / record.current_price) * 100
    : 0;

  if (movePct >= 12 || record.confidence_score < 55) return 'EXTREME';
  if (movePct >= 7) return 'HIGH';
  if (movePct >= 3) return 'MEDIUM';
  return 'LOW';
}

export function deriveIndicatorSetup(record: PredictionRecord): string {
  const expl = record.explanation;
  if (!expl) return 'UNKNOWN';

  const contributions = [
    ['trend', expl.trend_contribution ?? 0],
    ['momentum', (expl.rsi_contribution ?? 0) + (expl.macd_contribution ?? 0)],
    ['volume', expl.volume_contribution ?? 0],
    ['volatility', expl.volatility_contribution ?? 0],
    ['sentiment', expl.sentiment_contribution ?? 0],
    ['support_resistance', expl.support_resistance_contribution ?? 0],
  ] as const;

  const active = contributions
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);

  if (active.length === 0) return 'UNKNOWN';
  return active.join('+');
}

export function buildPredictionReliabilityDecision(
  verifiedRecords: PredictionRecord[],
  context: ReliabilityContext
): ReliabilityDecision {
  const verifiedOnly = verifiedRecords.filter(r => r.status === 'VERIFIED');
  const tickerStats = computeRow(
    verifiedOnly.filter(r => r.ticker === context.ticker),
    context.ticker
  );
  const sectorName = getSector(context.ticker);
  const sectorStats = computeRow(
    verifiedOnly.filter(r => getSector(r.ticker) === sectorName),
    sectorName
  );
  const timeframeStats = computeRow(
    verifiedOnly.filter(r => r.timeframe === context.timeframe),
    context.timeframe
  );
  const regimeName = context.regime || deriveMarketRegimeFromRecords(verifiedOnly, context.ticker, context.timeframe);
  const regimeStats = computeRow(
    verifiedOnly.filter(r => deriveMarketRegime(r) === regimeName),
    regimeName
  );
  const volatilityName = deriveVolatilityLevelFromContext(context);
  const volatilityStats = computeRow(
    verifiedOnly.filter(r => deriveVolatilityLevel(r) === volatilityName),
    volatilityName
  );
  const setupName = deriveSetupFromRecords(verifiedOnly, context.ticker, context.timeframe);
  const setupStats = computeRow(
    verifiedOnly.filter(r => deriveIndicatorSetup(r) === setupName),
    setupName
  );

  const breakdown = {
    ticker: tickerStats,
    sector: sectorStats,
    timeframe: timeframeStats,
    regime: regimeStats,
    volatility: volatilityStats,
    setup: setupStats,
  };

  const penalty = [
    scorePenalty(tickerStats),
    scorePenalty(sectorStats),
    scorePenalty(timeframeStats),
    scorePenalty(regimeStats),
    scorePenalty(volatilityStats),
    scorePenalty(setupStats),
  ].reduce((sum, value) => sum + value, 0);

  let adjustedConfidence = Math.max(0, Math.min(100, Math.round(context.currentConfidence - penalty)));
  const reliabilityGrade = aggregateGrade(Object.values(breakdown));
  const warnings = collectWarnings(breakdown);

  if (reliabilityGrade === 'LOW') {
    adjustedConfidence = Math.min(adjustedConfidence, 74);
    warnings.push('Low historical reliability is capping signal strength.');
  } else if (reliabilityGrade === 'INSUFFICIENT_DATA') {
    adjustedConfidence = Math.min(adjustedConfidence, 64);
    warnings.push('Insufficient verified samples are limiting this signal.');
  }

  const signalStrength = classifySignalStrength(adjustedConfidence);
  const strongBlocked = reliabilityGrade === 'LOW' || reliabilityGrade === 'INSUFFICIENT_DATA';
  const finalSignalStrength = strongBlocked && signalStrength === 'STRONG_SIGNAL'
    ? 'MODERATE_SIGNAL'
    : signalStrength;

  if (adjustedConfidence < 55 || isNoEdge(breakdown)) {
    return {
      confidence: adjustedConfidence < 55 ? adjustedConfidence : 54,
      signalStrength: 'NO_SIGNAL',
      reliabilityGrade,
      warnings: [...new Set([...warnings, 'Historical edge is too weak to trade.'])],
      breakdown,
    };
  }

  return {
    confidence: adjustedConfidence,
    signalStrength: finalSignalStrength,
    reliabilityGrade,
    warnings: [...new Set(warnings)],
    breakdown,
  };
}

export function buildPredictionAnalyticsReport(records: PredictionRecord[]): PredictionAnalyticsReport {
  const verified = records.filter(r => r.status === 'VERIFIED');
  const totalVerified = verified.length;

  const filteredRecords = verified.filter(r => getFilterReason(r) !== null);
  const validRecords = verified.filter(r => getFilterReason(r) === null);

  const filterBreakdown: Record<string, number> = {};
  filteredRecords.forEach(r => {
    const reason = getFilterReason(r) as string;
    filterBreakdown[reason] = (filterBreakdown[reason] || 0) + 1;
  });

  let noSignalCount = 0;
  let weakSignalCount = 0;
  let modSignalCount = 0;
  let strongSignalCount = 0;
  
  const tradeableRecords = validRecords.filter(r => {
    const confidence = r.calibrated_prob_up !== undefined && r.calibrated_prob_up !== null
      ? Math.max(r.calibrated_prob_up, 1 - r.calibrated_prob_up) * 100
      : r.confidence_score;
      
    const sig = r.signal_strength ?? classifySignalStrength(confidence);
    if (sig === 'NO_SIGNAL') noSignalCount++;
    else if (sig === 'WEAK_SIGNAL') weakSignalCount++;
    else if (sig === 'MODERATE_SIGNAL') modSignalCount++;
    else if (sig === 'STRONG_SIGNAL') strongSignalCount++;
    return sig === 'MODERATE_SIGNAL' || sig === 'STRONG_SIGNAL';
  });

  if (filteredRecords.length + validRecords.length !== totalVerified) {
    throw new Error(`Diagnostic Error: Filtered (${filteredRecords.length}) + Valid (${validRecords.length}) does not equal Total Verified (${totalVerified})`);
  }
  if (modSignalCount + strongSignalCount !== tradeableRecords.length) {
    throw new Error(`Diagnostic Error: Tradeable counts (${tradeableRecords.length}) do not match valid MODERATE + STRONG (${modSignalCount + strongSignalCount})`);
  }

  const overall = computeSummary(validRecords);
  const tradeable = computeSummary(tradeableRecords);

  const stockReliability = buildGroupedRows(verified, (r) => r.ticker);
  const sectorReliability = buildGroupedRows(verified, (r) => getSector(r.ticker));
  const timeframeReliability = buildGroupedRows(verified, (r) => r.timeframe);
  const trendRegimeReliability = buildGroupedRows(verified, (r) => r.trend_regime ?? 'UNKNOWN');
  const volatilityRegimeReliability = buildGroupedRows(verified, (r) => r.volatility_regime ?? 'UNKNOWN');
  const combinedRegimeReliability = buildGroupedRows(verified, (r) => `${r.trend_regime ?? 'UNKNOWN'} + ${r.volatility_regime ?? 'UNKNOWN'}`);
  const confidenceBucketPerformance = buildGroupedRows(verified, (r) => getConfidenceBucketLabel(r.confidence_score));
  const failureAnalysis = buildFailureAnalysis(verified);

  return {
    overallAccuracy: overall.accuracy,
    tradeableAccuracy: tradeable.accuracy,
    accuracyBeforeFiltering: overall.accuracy,
    accuracyAfterFiltering: tradeable.accuracy,
    overallWinLossRatio: overall.winLossRatio,
    winLossRatioAfterFiltering: tradeable.winLossRatio,
    medianError: overall.medianError,
    medianErrorAfterFiltering: tradeable.medianError,
    totalVerified,
    filteredPredictionsCount: filteredRecords.length,
    filterBreakdown,
    noSignalCount,
    weakSignalCount,
    modSignalCount,
    strongSignalCount,
    tradeablePredictionsCount: tradeable.count,
    targetAchieved: overall.accuracy >= 55 && tradeable.accuracy >= 58 && tradeable.winLossRatio > 1.3 && tradeable.medianError < 1.5,
    stockReliability,
    sectorReliability,
    timeframeReliability,
    trendRegimeReliability,
    volatilityRegimeReliability,
    combinedRegimeReliability,
    confidenceBucketPerformance,
    failureAnalysis,
  };
}

function computeRow(records: PredictionRecord[], label: string): PredictionReliabilityRow {
  const verified = records.filter(r => r.status === 'VERIFIED');
  const correct = verified.filter(r => r.prediction_result === 'CORRECT').length;
  const incorrect = verified.filter(r => r.prediction_result === 'INCORRECT').length;
  const partial = verified.filter(r => r.prediction_result === 'PARTIALLY_CORRECT').length;
  const neutral = verified.filter(r => r.prediction_result === 'NEUTRAL').length;
  const noSignal = verified.filter(r => classifySignalStrength(r.confidence_score) === 'NO_SIGNAL').length;
  const tradeableRecords = verified.filter(isTradeableRecord);
  const tradeableCorrect = tradeableRecords.filter(r => r.prediction_result === 'CORRECT').length;
  const tradeableIncorrect = tradeableRecords.filter(r => r.prediction_result === 'INCORRECT').length;
  const tradeablePartial = tradeableRecords.filter(r => r.prediction_result === 'PARTIALLY_CORRECT').length;
  const tradeableEvaluated = tradeableCorrect + tradeableIncorrect + tradeablePartial;
  const evaluated = correct + incorrect + partial;
  const accuracy = evaluated > 0 ? ((correct + partial * 0.5) / evaluated) * 100 : 0;
  const winLossRatio = computeProfitWinLossRatio(verified);
  const errors = verified.flatMap(r => typeof r.error_percentage === 'number' ? [r.error_percentage] : []);

  return {
    label,
    verifiedCount: verified.length,
    correctCount: correct,
    incorrectCount: incorrect,
    partialCount: partial,
    neutralCount: neutral,
    noSignalCount: noSignal,
    accuracy: round(accuracy),
    tradeableAccuracy: round(tradeableEvaluated > 0 ? ((tradeableCorrect + tradeablePartial * 0.5) / tradeableEvaluated) * 100 : 0),
    tradeableCount: tradeableRecords.length,
    winLossRatio: round(winLossRatio),
    medianError: round(median(errors)),
    reliabilityGrade: gradeFromMetrics(verified.length, accuracy, winLossRatio),
    warning: warningFromMetrics(label, verified.length, accuracy, winLossRatio),
  };
}

function buildGroupedRows(
  records: PredictionRecord[],
  getLabel: (record: PredictionRecord) => string
): PredictionReliabilityRow[] {
  const groups = new Map<string, PredictionRecord[]>();
  for (const record of records) {
    const label = getLabel(record);
    const arr = groups.get(label) ?? [];
    arr.push(record);
    groups.set(label, arr);
  }

  return Array.from(groups.entries())
    .map(([label, group]) => computeRow(group, label))
    .sort((a, b) => b.verifiedCount - a.verifiedCount || b.accuracy - a.accuracy);
}

function buildFailureAnalysis(records: PredictionRecord[]): FailureAnalysisRow[] {
  const failures = records.filter(r => r.prediction_result === 'INCORRECT');
  const dimensions: FailureAnalysisRow[] = [];

  const pushRows = (
    dimension: FailureAnalysisRow['dimension'],
    getLabel: (record: PredictionRecord) => string
  ) => {
    const groups = new Map<string, PredictionRecord[]>();
    for (const record of records) {
      const label = getLabel(record);
      const arr = groups.get(label) ?? [];
      arr.push(record);
      groups.set(label, arr);
    }

    for (const [label, group] of groups.entries()) {
      const row = computeRow(group, label);
      const failureCount = failures.filter(r => getLabel(r) === label).length;
      dimensions.push({
        ...row,
        dimension,
        failures: failureCount,
        failureRate: row.verifiedCount > 0 ? round((failureCount / row.verifiedCount) * 100) : 0,
      });
    }
  };

  pushRows('ticker', r => r.ticker);
  pushRows('sector', r => getSector(r.ticker));
  pushRows('timeframe', r => r.timeframe);
  pushRows('market_regime', r => deriveMarketRegime(r));
  pushRows('confidence_bucket', r => getConfidenceBucketLabel(r.confidence_score));
  pushRows('volatility_level', r => deriveVolatilityLevel(r));
  pushRows('indicator_setup', r => deriveIndicatorSetup(r));

  return dimensions.sort((a, b) => b.failures - a.failures || b.failureRate - a.failureRate);
}

function computeSummary(records: PredictionRecord[]) {
  const verified = records.filter(r => r.status === 'VERIFIED');
  const correct = verified.filter(r => r.prediction_result === 'CORRECT').length;
  const incorrect = verified.filter(r => r.prediction_result === 'INCORRECT').length;
  const partial = verified.filter(r => r.prediction_result === 'PARTIALLY_CORRECT').length;
  const evaluated = correct + incorrect + partial;
  const accuracy = evaluated > 0 ? ((correct + partial * 0.5) / evaluated) * 100 : 0;
  const winLossRatio = computeProfitWinLossRatio(verified);
  const errors = verified.flatMap(r => typeof r.error_percentage === 'number' ? [r.error_percentage] : []);
  return {
    count: verified.length,
    accuracy: round(accuracy),
    winLossRatio: round(winLossRatio),
    medianError: round(median(errors)),
  };
}

function computeProfitWinLossRatio(records: PredictionRecord[]): number {
  let gains = 0;
  let losses = 0;

  for (const record of records) {
    if (!Number.isFinite(record.current_price) || !Number.isFinite(record.actual_price)) continue;
    const direction = record.predicted_direction === 'UP' ? 1 : record.predicted_direction === 'DOWN' ? -1 : 0;
    const pnl = ((record.actual_price as number) - record.current_price) * direction;
    if (pnl > 0) gains += pnl;
    if (pnl < 0) losses += Math.abs(pnl);
  }

  if (losses === 0) return gains > 0 ? gains : 0;
  return gains / losses;
}

function scorePenalty(row: PredictionReliabilityRow): number {
  if (row.reliabilityGrade === 'INSUFFICIENT_DATA') return 0;
  if (row.reliabilityGrade === 'LOW') return 10;
  if (row.accuracy < 55 || row.winLossRatio < 1.05) return 8;
  if (row.accuracy < 60) return 4;
  return 0;
}

function aggregateGrade(rows: PredictionReliabilityRow[]): ReliabilityGrade {
  if (rows.some(row => row.reliabilityGrade === 'INSUFFICIENT_DATA')) return 'INSUFFICIENT_DATA';
  if (rows.some(row => row.reliabilityGrade === 'LOW')) return 'LOW';
  if (rows.some(row => row.reliabilityGrade === 'MEDIUM')) return 'MEDIUM';
  return 'HIGH';
}

function collectWarnings(rows: Record<string, PredictionReliabilityRow>): string[] {
  const warnings: string[] = [];
  for (const [key, row] of Object.entries(rows)) {
    if (row.warning) warnings.push(`${key.toUpperCase()}: ${row.warning}`);
  }
  return warnings;
}

function warningFromMetrics(label: string, count: number, accuracy: number, winLossRatio: number): string {
  if (count < MIN_LOW_SAMPLE) return `${label} has too few verified samples.`;
  if (accuracy < 55 || winLossRatio < 1.05) return `${label} has weak historical edge.`;
  if (accuracy < 55) return `${label} is below tradeable accuracy threshold.`;
  return '';
}

function gradeFromMetrics(count: number, accuracy: number, winLossRatio: number): ReliabilityGrade {
  if (count < MIN_MEDIUM_SAMPLE) return 'INSUFFICIENT_DATA';
  if (count < 20) {
    if (accuracy < 55 || winLossRatio < 1.05) return 'LOW';
    return 'INSUFFICIENT_DATA';
  }
  if (accuracy >= 60 && winLossRatio >= 1.25 && count >= MIN_HIGH_SAMPLE) return 'HIGH';
  if (accuracy >= 55 && winLossRatio >= 1.05) return 'MEDIUM';
  return 'LOW';
}

function deriveMarketRegimeFromRecords(records: PredictionRecord[], ticker: string, timeframe: string): string {
  const match = records.find(r => r.ticker === ticker && r.timeframe === timeframe);
  return match ? deriveMarketRegime(match) : 'UNKNOWN';
}

function deriveVolatilityLevelFromContext(context: ReliabilityContext): string {
  const movePct = context.currentPrice > 0
    ? Math.abs((context.predictedPrice - context.currentPrice) / context.currentPrice) * 100
    : 0;

  if (movePct >= 12) return 'EXTREME';
  if (movePct >= 7) return 'HIGH';
  if (movePct >= 3) return 'MEDIUM';
  return 'LOW';
}

function deriveSetupFromRecords(records: PredictionRecord[], ticker: string, timeframe: string): string {
  const record = records.find(r => r.ticker === ticker && r.timeframe === timeframe);
  return record ? deriveIndicatorSetup(record) : 'UNKNOWN';
}

function isNoEdge(rows: Record<string, PredictionReliabilityRow>): boolean {
  const evaluated = Object.values(rows).filter(r => r.reliabilityGrade !== 'INSUFFICIENT_DATA');
  if (evaluated.length === 0) return false;
  const bad = evaluated.filter(row => row.accuracy < 55 || row.winLossRatio < 1.05 || row.reliabilityGrade === 'LOW');
  return bad.length > evaluated.length / 2;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function round(value: number): number {
  return Number(value.toFixed(2));
}
