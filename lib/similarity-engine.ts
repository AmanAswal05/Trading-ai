import { PredictionRecord } from './predictions-db';

export interface SimilarityMatch {
  matchCount: number;
  successRate: number;        // percentage of CORRECT / PARTIALLY_CORRECT matches
  avgErrorPercent: number;
  bestTimeframe: string;
  regimeMatch: boolean;
  message: string;            // e.g. "Historically, similar setups achieved 67.4% accuracy based on 2,418 verified predictions"
}

export interface IndicatorSnapshot {
  rsiLevel: 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT';  // <30, 30-70, >70
  macdSign: 'POSITIVE' | 'NEGATIVE';                 // histogram > 0 or <= 0
  trendPosition: 'ABOVE_SMA200' | 'BELOW_SMA200';
  volumeLevel: 'HIGH' | 'NORMAL' | 'LOW';            // vs 20d avg
  volatilityBucket: 'HIGH' | 'MEDIUM' | 'LOW';       // ATR/price thresholds
  regime?: string;
}

/**
 * Creates an indicator snapshot for historical similarity comparison.
 */
export function createSnapshot(
  indicators: any,
  price: number,
  volume: number,
  avgVolume20: number,
  regimeName?: string
): IndicatorSnapshot {
  const { rsi14, macd, sma200, atr14 } = indicators;

  // RSI Level
  let rsiLevel: 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT' = 'NEUTRAL';
  if (rsi14 < 30) rsiLevel = 'OVERSOLD';
  else if (rsi14 > 70) rsiLevel = 'OVERBOUGHT';

  // MACD Sign
  const macdSign = (macd && macd.histogram > 0) ? 'POSITIVE' : 'NEGATIVE';

  // Trend Position
  const trendPosition = price > (sma200 || price) ? 'ABOVE_SMA200' : 'BELOW_SMA200';

  // Volume Level
  const volRatio = volume / (avgVolume20 || volume || 1);
  let volumeLevel: 'HIGH' | 'NORMAL' | 'LOW' = 'NORMAL';
  if (volRatio > 1.3) volumeLevel = 'HIGH';
  else if (volRatio < 0.7) volumeLevel = 'LOW';

  // Volatility Bucket
  const atrRatio = (atr14 || 0) / price;
  let volatilityBucket: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (atrRatio > 0.03) volatilityBucket = 'HIGH';
  else if (atrRatio < 0.01) volatilityBucket = 'LOW';

  return {
    rsiLevel,
    macdSign,
    trendPosition,
    volumeLevel,
    volatilityBucket,
    regime: regimeName,
  };
}

/**
 * Find historical predictions that match the snapshot.
 * Requires at least 3 matching criteria (out of 5) to count as similar.
 */
export function findSimilarSetups(
  snapshot: IndicatorSnapshot,
  timeframe: string,
  confidence: number,
  ticker: string,
  verifiedRecords: PredictionRecord[]
): SimilarityMatch {
  const verified = verifiedRecords.filter(r => r.status === 'VERIFIED');

  if (verified.length === 0) {
    return {
      matchCount: 0,
      successRate: 0,
      avgErrorPercent: 0,
      bestTimeframe: timeframe,
      regimeMatch: false,
      message: 'Insufficient historical data for similarity analysis',
    };
  }

  const matches: { record: PredictionRecord; matchScore: number }[] = [];

  for (const record of verified) {
    // We need some indicators or prediction parameters.
    // If there's no indicator snapshot stored on the record, we can infer it from the explanation contribution fields
    // or estimate it.
    // Let's deduce properties from the record.
    const recExplanation = record.explanation;
    const recMetrics = record.metrics;

    if (!recExplanation || !recMetrics) continue;

    // Deduce simulated snapshot properties for the historical record
    // Trend: trend_contribution > 0 implies ABOVE_SMA200
    const recTrend = recExplanation.trend_contribution > 15 ? 'ABOVE_SMA200' : 'BELOW_SMA200';
    
    // RSI Level: rsi_contribution > 15 can imply extreme or neutral based on direction
    let recRsi: 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT' = 'NEUTRAL';
    if (recExplanation.rsi_contribution > 25) {
      recRsi = record.predicted_direction === 'UP' ? 'OVERSOLD' : 'OVERBOUGHT';
    }

    // MACD Sign
    const recMacdSign = recExplanation.macd_contribution > 10 ? 'POSITIVE' : 'NEGATIVE';

    // Volatility
    let recVolBucket: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (recMetrics.volatility_score > 7) recVolBucket = 'HIGH';
    else if (recMetrics.volatility_score < 3) recVolBucket = 'LOW';

    // Verify how many matching criteria:
    let matchScore = 0;
    if (recRsi === snapshot.rsiLevel) matchScore++;
    if (recMacdSign === snapshot.macdSign) matchScore++;
    if (recTrend === snapshot.trendPosition) matchScore++;
    if (recVolBucket === snapshot.volatilityBucket) matchScore++;
    
    // Confidence match
    if (Math.abs(record.confidence_score - confidence) <= 10) matchScore++;

    if (matchScore >= 3) {
      matches.push({ record, matchScore });
    }
  }

  if (matches.length < 5) {
    return {
      matchCount: 0,
      successRate: 0,
      avgErrorPercent: 0,
      bestTimeframe: timeframe,
      regimeMatch: false,
      message: 'Insufficient historical data for similarity analysis',
    };
  }

  // Calculate success rate and avg error
  let totalScore = 0;
  let correctMatches = 0;
  let partialMatches = 0;
  let totalError = 0;
  let regimeMatchCount = 0;

  // Timeframe success counter
  const tfStats: Record<string, { total: number; correct: number }> = {};

  for (const m of matches) {
    const r = m.record;
    const res = r.prediction_result;

    if (res === 'CORRECT') correctMatches++;
    else if (res === 'PARTIALLY_CORRECT') partialMatches++;

    totalScore += 1;
    totalError += r.error_percentage || 0;

    // Check regime match
    if (snapshot.regime && r.explanation?.ai_reasoning_summary?.toLowerCase().includes(snapshot.regime.toLowerCase())) {
      regimeMatchCount++;
    }

    // Accumulate timeframe stats
    const tf = r.timeframe;
    if (!tfStats[tf]) tfStats[tf] = { total: 0, correct: 0 };
    tfStats[tf].total++;
    if (res === 'CORRECT' || res === 'PARTIALLY_CORRECT') {
      tfStats[tf].correct++;
    }
  }

  const successRate = ((correctMatches + partialMatches * 0.5) / totalScore) * 100;
  const avgErrorPercent = totalError / totalScore;

  // Find best timeframe
  let bestTimeframe = timeframe;
  let maxRate = -1;
  for (const [tf, stats] of Object.entries(tfStats)) {
    if (stats.total >= 3) {
      const rate = (stats.correct / stats.total) * 100;
      if (rate > maxRate) {
        maxRate = rate;
        bestTimeframe = tf;
      }
    }
  }

  const formattedSuccessRate = successRate.toFixed(1);
  const formattedCount = totalScore.toLocaleString();
  const message = `Historically, similar setups achieved ${formattedSuccessRate}% accuracy based on ${formattedCount} verified predictions.`;

  return {
    matchCount: totalScore,
    successRate: Number(formattedSuccessRate),
    avgErrorPercent: Number(avgErrorPercent.toFixed(2)),
    bestTimeframe,
    regimeMatch: regimeMatchCount > 0,
    message,
  };
}
