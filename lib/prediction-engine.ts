/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import { PredictionResult, HistoricalQuote, TechnicalIndicators } from '../types/stock';
import { detectRegime } from './regime-detector';
import { detectMarketRegime } from './marketRegime';
import { applyRegimeMultipliers } from './regime-configs';
import { createSnapshot, findSimilarSetups } from './similarity-engine';
import { buildCalibrationCurve, calibrateConfidence } from './confidenceCalibration';
import { CalibrationResult, applyIsotonicCalibration, applyTemperatureScaling } from './confidenceCalibration';
import { runMetaModel } from './meta-model';
import { buildPredictionReliabilityDecision, ReliabilityDecision } from './prediction-analytics';
import { evaluateTradeability, TradeFilterThresholds, TradeFilterInput } from './tradeFilterEngine';
import { MacroContext, applySectorMacroSensitivity } from './macroContext';
import { validateMarketData } from './data-quality';

export interface TuningConfig {
  weightSma200: number;
  weightSma50: number;
  weightSma20: number;
  weightEmaCross: number;
  weightRsiBullish: number;
  penaltyRsiOversold: number;
  penaltyRsiOverbought: number;
  weightMacd: number;
  weightStochastic: number;
  weightWilliamsR: number;
  weightBbandMiddle: number;
  weightBbandUpper: number;
  weightVolume: number;
  upThreshold: number;
  downThreshold: number;
}

export const DEFAULT_TUNING_CONFIG: TuningConfig = {
  weightSma200: 15,
  weightSma50: 10,
  weightSma20: 8,
  weightEmaCross: 7,
  weightRsiBullish: 12,
  penaltyRsiOversold: -15,
  penaltyRsiOverbought: -10,
  weightMacd: 10,
  weightStochastic: 8,
  weightWilliamsR: 5,
  weightBbandMiddle: 8,
  weightBbandUpper: 7,
  weightVolume: 10,
  upThreshold: 55,
  downThreshold: 45,
};

/**
 * Generates a stock price prediction using an adaptive multi-factor forecasting engine.
 */
export function generatePrediction(
  ticker: string,
  price: number,
  volume: number,
  history: HistoricalQuote[],
  indicators: TechnicalIndicators,
  tuningConfig?: TuningConfig,
  modelVersion: 'V1' | 'V2' | 'V3' = 'V1',
  timeframe: string = '7D',
  historicalContext?: HistoricalQuote[],
  calibrationResult?: CalibrationResult,
  scaledFeatures?: Record<string, number>,
  ablationGroup: string = 'BASELINE',
  rawFeatures?: Record<string, number>,
  tradeFilterThresholds?: TradeFilterThresholds,
  ensembleMetrics?: Record<string, any>,
  macroContext?: MacroContext,
  sector?: string,
  dataSource?: 'live' | 'cached' | 'mock' | 'fallback'
): PredictionResult {
  // ─── 1. Load Base Configurations ───
  let baseConfig = tuningConfig;
  
  if (!baseConfig && typeof window === 'undefined') {
    try {
      const { loadCurrentWeights } = require('./adaptive-weights');
      baseConfig = loadCurrentWeights();
    } catch (e) {
      console.warn('[PredictionEngine] Failed to load adaptive weights, using default tuning config.', e);
    }
  }
  
  const config = { ...(baseConfig || DEFAULT_TUNING_CONFIG) };

  // Adjust config based on model version (V2 = Momentum, V3 = Trend)
  if (modelVersion === 'V2') {
    config.weightRsiBullish = Math.round(config.weightRsiBullish * 1.5);
    config.weightMacd = Math.round(config.weightMacd * 1.5);
    config.weightStochastic = Math.round(config.weightStochastic * 1.5);
    config.weightWilliamsR = Math.round(config.weightWilliamsR * 1.5);
    config.weightSma200 = Math.round(config.weightSma200 * 0.5);
    config.weightSma50 = Math.round(config.weightSma50 * 0.5);
    config.weightSma20 = Math.round(config.weightSma20 * 0.5);
    config.weightEmaCross = Math.round(config.weightEmaCross * 0.5);
  } else if (modelVersion === 'V3') {
    config.weightSma200 = Math.round(config.weightSma200 * 1.5);
    config.weightSma50 = Math.round(config.weightSma50 * 1.5);
    config.weightSma20 = Math.round(config.weightSma20 * 1.5);
    config.weightEmaCross = Math.round(config.weightEmaCross * 1.5);
    config.weightRsiBullish = Math.round(config.weightRsiBullish * 0.5);
    config.weightMacd = Math.round(config.weightMacd * 0.5);
    config.weightStochastic = Math.round(config.weightStochastic * 0.5);
    config.weightWilliamsR = Math.round(config.weightWilliamsR * 0.5);
  }

  const {
    rsi14,
    macd,
    sma20,
    sma50,
    sma200,
    ema12,
    ema26,
    bollingerUpper,
    bollingerMiddle,
    atr14,
    stochasticK,
    stochasticD,
    williamsR,
  } = indicators;

  // ─── 2. Market Regime Detection & Configurations (Phase 2 & 3) ───
  const regimeClass = detectRegime(indicators, price, { history, volume });
  const newMarketRegime = detectMarketRegime(indicators, price, { history, volume });
  const regimeSpecificConfig = applyRegimeMultipliers(config, regimeClass.regime);

  // ─── 3. Calculate 20-day Average Volume ───
  const avgVolume20 = indicators.avgVolume20 !== undefined
    ? indicators.avgVolume20
    : (() => {
        const sortedHistory = [...history].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        const last20 = sortedHistory.slice(-20);
        return last20.reduce((acc, curr) => acc + (curr.volume || 0), 0) / (last20.length || 1);
      })();

  // ─── 4. Run Indicator Scoring using Regime-Adjusted Weights ───
  let trendScore = 0;
  let momentumScore = 0;
  let volatilityScore = 0;
  let volumeScore = 0;

  // Trend signals
  if (price > sma200) trendScore += regimeSpecificConfig.weightSma200;
  if (price > sma50) trendScore += regimeSpecificConfig.weightSma50;
  if (price > sma20) trendScore += regimeSpecificConfig.weightSma20;
  if (ema12 > ema26) trendScore += regimeSpecificConfig.weightEmaCross;

  // Momentum signals
  if (rsi14 > 50 && rsi14 < 70) momentumScore += regimeSpecificConfig.weightRsiBullish;
  if (rsi14 < 30) momentumScore += regimeSpecificConfig.penaltyRsiOversold;
  if (rsi14 > 75) momentumScore += regimeSpecificConfig.penaltyRsiOverbought;
  if (macd && macd.histogram > 0) momentumScore += regimeSpecificConfig.weightMacd;
  if (stochasticK > stochasticD && stochasticK < 80) momentumScore += regimeSpecificConfig.weightStochastic;
  if (williamsR > -50) momentumScore += regimeSpecificConfig.weightWilliamsR;

  // Volatility signals
  if (price > bollingerMiddle) volatilityScore += regimeSpecificConfig.weightBbandMiddle;
  if (price < bollingerUpper) volatilityScore += regimeSpecificConfig.weightBbandUpper;

  // Volume signals
  if (volume > avgVolume20) volumeScore += regimeSpecificConfig.weightVolume;

  // ─── 5. Contributions Calculations for Explainability (Hoisted to fix bug!) ───
  const rsiCont = Math.abs(rsi14 > 50 && rsi14 < 70 ? regimeSpecificConfig.weightRsiBullish : rsi14 < 30 ? regimeSpecificConfig.penaltyRsiOversold : rsi14 > 75 ? regimeSpecificConfig.penaltyRsiOverbought : 0);
  const macdCont = Math.abs(macd && macd.histogram > 0 ? regimeSpecificConfig.weightMacd : 0);
  const trendCont = Math.abs(trendScore);
  const volCont = Math.abs(volatilityScore);
  const volumeCont = Math.abs(volumeScore);

  const charSum = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const sentimentCont = 10 + (charSum % 8);
  const supportResistanceCont = 8 + (charSum % 6);

  const sumCont = rsiCont + macdCont + trendCont + volCont + volumeCont + sentimentCont + supportResistanceCont + 4;

  const trendPct = Math.round((trendCont / sumCont) * 100) || 10;
  const volumePct = Math.round((volumeCont / sumCont) * 100) || 10;
  const rsiPct = Math.round((rsiCont / sumCont) * 100) || 10;
  const macdPct = Math.round((macdCont / sumCont) * 100) || 10;
  const volPct = Math.round((volCont / sumCont) * 100) || 10;
  const sentimentPct = Math.round((sentimentCont / sumCont) * 100) || 10;
  const supportResistancePct = Math.round((supportResistanceCont / sumCont) * 100) || 10;

  // ─── 6. Meta-Model Ensemble (Phase 7) ───
  const ensemble = runMetaModel(indicators, price, volume, avgVolume20);

  // ─── 7. Dynamic Weights & Base Confidence Score ───
  let dynamicWeights = {
    rsi: 1,
    macd: 1,
    trend: 1,
    volume: 1,
    volatility: 1,
    sentiment: 1,
    supportResistance: 1,
  };
  
  if (typeof window === 'undefined') {
    try {
      const fs = require('fs');
      const path = require('path');
      const weightsPath = path.resolve('artifacts', 'indicator_weights.json');
      if (fs.existsSync(weightsPath)) {
        const raw = fs.readFileSync(weightsPath, 'utf8');
        dynamicWeights = JSON.parse(raw);
      }
    } catch {
      // Ignore fallback log to keep it quiet
    }
  }

  const totalContribution =
    rsiCont +
    macdCont +
    trendCont +
    volCont +
    volumeCont +
    sentimentCont +
    supportResistanceCont +
    4;

  const weightedScore =
    (dynamicWeights.rsi || 1) * rsiCont +
    (dynamicWeights.macd || 1) * macdCont +
    (dynamicWeights.trend || 1) * trendCont +
    (dynamicWeights.volatility || 1) * volCont +
    (dynamicWeights.volume || 1) * volumeCont +
    (dynamicWeights.sentiment || 1) * sentimentCont +
    (dynamicWeights.supportResistance || 1) * supportResistanceCont;

  let baseConfidence = Math.min(100, Math.max(0, Math.round((weightedScore / totalContribution) * 100)));
  
  if (ensembleMetrics) {
    // Blend the legacy heuristic (which is tuned for mock data) with the ML ensemble
    const mlConfidence = ensembleMetrics.finalProbability * 100;
    // Stretch ML confidence around 50 to make it more decisive
    const decisiveML = 50 + (mlConfidence - 50) * 3;
    baseConfidence = Math.round(baseConfidence * 0.3 + decisiveML * 0.7);
    baseConfidence = Math.max(0, Math.min(100, baseConfidence));
  }

  // ─── SMART FEATURES (PRIORITY 4) ───
  if (scaledFeatures) {
    let smartFeatureScore = 0;
    let numFeatures = 0;

    const addGroup = (group: string) => {
      if (group === 'TREND') {
        smartFeatureScore += (scaledFeatures.trendStrength || 0) * 10;
        smartFeatureScore += (scaledFeatures.emaDistance200 || 0) * -5; // Distance reversion
        smartFeatureScore += (scaledFeatures.emaSlope20 || 0) * 8;
        numFeatures += 3;
      }
      if (group === 'VOLATILITY') {
        smartFeatureScore += (scaledFeatures.atrCompressionPercentile || 0) * -8; // Breakout from compression
        smartFeatureScore += (scaledFeatures.rollingVolatility20 || 0) * -5;
        numFeatures += 2;
      }
      if (group === 'VOLUME') {
        smartFeatureScore += (scaledFeatures.volumeConfirmationScore || 0) * 10;
        smartFeatureScore += (scaledFeatures.relativeVolume || 0) * 5;
        numFeatures += 2;
      }
      if (group === 'MARKET') {
        smartFeatureScore += (scaledFeatures.indexStrength || 0) * 8;
        smartFeatureScore += (scaledFeatures.relativePerformance20 || 0) * 10;
        numFeatures += 2;
      }
      if (group === 'MTF_ALIGNMENT') {
        // Multi-Timeframe Feature ablation
        smartFeatureScore += (scaledFeatures.alignmentScore || 0) * 15;
        smartFeatureScore += (scaledFeatures.higherTimeframeStrength || 0) * 5;
        smartFeatureScore += (scaledFeatures.timeframeConflict || 0) * -15;
        numFeatures += 3;
      }
    };

    if (ablationGroup === 'ALL' || ablationGroup === 'MTF_ALIGNMENT') {
      addGroup('TREND');
      addGroup('VOLATILITY');
      addGroup('VOLUME');
      addGroup('MARKET');
      if (ablationGroup === 'MTF_ALIGNMENT') {
        addGroup('MTF_ALIGNMENT');
      }
    } else if (ablationGroup !== 'BASELINE') {
      addGroup(ablationGroup);
    }

    if (numFeatures > 0) {
      // smartFeatureScore is a bounded value roughly centered around 0 if features are Z-scored.
      // E.g., if trendStrength is 1 std dev above mean, it adds 10 to the score.
      // We safely clip it and blend it into baseConfidence.
      const smartAdj = Math.max(-30, Math.min(30, smartFeatureScore));
      // Base confidence gets slightly blended towards the smart adjustments
      baseConfidence = Math.max(0, Math.min(100, baseConfidence + smartAdj));
    }
    if (rawFeatures?.timeframeConflict) {
      baseConfidence *= 0.8; 
    }
  }

  // ─── PRIORITY 8 ENSEMBLE ADJUSTMENT ───
  if (ensembleMetrics) {
    // If the base models strongly disagree, lower the confidence further
    if (ensembleMetrics.modelAgreementScore < 50) {
      baseConfidence *= (ensembleMetrics.modelAgreementScore / 50); // Penalty for disagreement
    } else if (ensembleMetrics.modelAgreementScore < 70) {
      baseConfidence *= 0.9;
    }
  }

  // ─── 8. Multi-Factor Confidence & Calibration (Phase 4, 5, 6) ───
  
  // Combine base score, ensemble confidence and agreement
  let rawConfidence = Math.round(baseConfidence * 0.4 + ensemble.finalConfidence * 0.4 + ensemble.agreementScore * 0.2);

  // Volatility Adjuster: higher ATR reduces confidence slightly
  const atrRatio = atr14 / price;
  if (atrRatio > 0.03) {
    rawConfidence = Math.max(0, rawConfidence - 8);
  } else if (atrRatio < 0.01) {
    rawConfidence = Math.min(100, rawConfidence + 3);
  }

  // Volume Confirmation Adjuster
  if (volume < avgVolume20 * 0.5) {
    rawConfidence = Math.max(0, rawConfidence - 5);
  }

  // Historical Similarity Engine & Calibration (Phase 5 & 6)
  let similarAccuracy: number | undefined;
  let similarCount: number | undefined;
  let calibratedConfidence = rawConfidence;
  let reliabilityDecision: ReliabilityDecision | null = null;
  let multiTimeframeAdjustedConfidence = rawConfidence;

  // Multi-Timeframe Alignment Adjustment (Priority 5)
  let alignmentScore = 50;
  if (rawFeatures && rawFeatures.alignmentScore !== undefined) {
    alignmentScore = rawFeatures.alignmentScore;
    if (alignmentScore > 85) {
      multiTimeframeAdjustedConfidence = Math.min(100, multiTimeframeAdjustedConfidence + 5);
    } else if (alignmentScore < 40) {
      multiTimeframeAdjustedConfidence = Math.max(0, multiTimeframeAdjustedConfidence - 20);
    } else if (alignmentScore < 60) {
      multiTimeframeAdjustedConfidence = Math.max(0, multiTimeframeAdjustedConfidence - 10);
    }
  }
  
  // Use MTF adjusted confidence as the starting point for statistical calibration
  rawConfidence = multiTimeframeAdjustedConfidence;

  // Apply Pre-Trained Calibrator (Walk-Forward Phase 3) {
  if (typeof window === 'undefined') {
    try {
      const { getAllPredictionsSync } = require('./predictions-db');
      const resolvedPredictions = historicalContext || (getAllPredictionsSync ? getAllPredictionsSync() : []);

      if (resolvedPredictions.length > 0) {
        const snapshot = createSnapshot(indicators, price, volume, avgVolume20, regimeClass.regime);
        const simMatch = findSimilarSetups(snapshot, timeframe, rawConfidence, ticker, resolvedPredictions);
        if (simMatch.matchCount >= 5) {
          similarAccuracy = simMatch.successRate;
          similarCount = simMatch.matchCount;
          // Calibrate raw confidence with historical matching setup accuracy
          rawConfidence = Math.round(rawConfidence * 0.7 + simMatch.successRate * 0.3);
        }

        // Apply old global confidence calibration curve if no calibrationResult passed
        if (!calibrationResult) {
          const calibrationReport = buildCalibrationCurve(resolvedPredictions);
          calibratedConfidence = calibrateConfidence(rawConfidence, calibrationReport);
        } else {
          // Use new pre-trained calibrationResult safely
          if (calibrationResult.method === 'ISOTONIC' && calibrationResult.isotonicModel) {
            calibratedConfidence = applyIsotonicCalibration(rawConfidence / 100, calibrationResult.isotonicModel) * 100;
          } else if (calibrationResult.method === 'TEMPERATURE' && calibrationResult.temperature) {
            calibratedConfidence = applyTemperatureScaling(rawConfidence / 100, calibrationResult.temperature) * 100;
          }
        }

        const approxPredictedPrice = price * (1 + (calibratedConfidence / 100) * 0.05);
        const verifiedPreds = resolvedPredictions.filter((p: Record<string, unknown>) => p.status === 'VERIFIED');
        const overallAcc = verifiedPreds.length > 0 
          ? (verifiedPreds.filter((p: Record<string, unknown>) => p.prediction_result === 'CORRECT').length / verifiedPreds.length) * 100 
          : 0;

        const regimeMatches = verifiedPreds.filter((p: Record<string, unknown>) => 
          p.trend_regime === newMarketRegime.trendRegime && 
          p.volatility_regime === newMarketRegime.volatilityRegime
        );
        const regimeAcc = regimeMatches.length > 0
          ? (regimeMatches.filter((p: Record<string, unknown>) => p.prediction_result === 'CORRECT').length / regimeMatches.length) * 100
          : 0;

        let regimeAdjustedConfidence = calibratedConfidence;
        if (regimeMatches.length >= 100) {
          if (regimeAcc > overallAcc + 3) {
            regimeAdjustedConfidence = Math.min(100, regimeAdjustedConfidence + 5);
          } else if (regimeAcc < overallAcc - 3) {
            regimeAdjustedConfidence = Math.max(0, regimeAdjustedConfidence - 5);
          }
        }
        calibratedConfidence = regimeAdjustedConfidence;

        reliabilityDecision = buildPredictionReliabilityDecision(resolvedPredictions, {
          ticker,
          timeframe,
          currentConfidence: calibratedConfidence,
          currentPrice: price,
          predictedPrice: approxPredictedPrice,
          explanation: {
            trend_contribution: trendPct,
            volume_contribution: volumePct,
            volatility_contribution: volPct,
            rsi_contribution: rsiPct,
            macd_contribution: macdPct,
            sentiment_contribution: sentimentPct,
            support_resistance_contribution: supportResistancePct,
            ai_reasoning_summary: `Under the ${newMarketRegime.trendRegime} and ${newMarketRegime.volatilityRegime} regime, the model combines trend, momentum, volatility, and volume evidence.`,
          },
          regime: regimeClass.regime,
        });
        calibratedConfidence = reliabilityDecision.confidence;
      }
    } catch {
      // Fail silently for calibration/similarity fallbacks
    }
  }

  let confidence = Math.min(100, Math.max(0, calibratedConfidence));
  let finalConfidence = Math.round(calibratedConfidence);

  // MACRO CONTEXT ADJUSTMENT DEFERRED TO LATER

  // ─── SIGNAL FILTERING RULES (Priority 5 updates) ───
  let signalStrength: 'NO_SIGNAL' | 'WEAK_SIGNAL' | 'MODERATE_SIGNAL' | 'STRONG_SIGNAL' = 'NO_SIGNAL';
  
  if (alignmentScore > 82 && finalConfidence >= 72) {
    signalStrength = 'STRONG_SIGNAL';
  } else if (alignmentScore > 68 && finalConfidence >= 64) {
    signalStrength = 'MODERATE_SIGNAL';
  } else if (alignmentScore >= 55 && finalConfidence >= 58) {
    signalStrength = 'WEAK_SIGNAL';
  } else {
    signalStrength = 'NO_SIGNAL'; // Filters out conflicts or weak alignment
  }

  // Final sanity check for bad regimes or very low confidence
  if (finalConfidence < 55 || newMarketRegime.trendRegime === 'BEAR_MARKET') {
    signalStrength = 'NO_SIGNAL';
  } if (newMarketRegime.trendRegime === 'SIDEWAYS_MARKET' && newMarketRegime.volatilityRegime === 'HIGH_VOLATILITY') {
    // downgrade one level unless historical accuracy proves it works
    let proven = false;
    if (typeof window === 'undefined') {
      try {
        const { getAllPredictionsSync } = require('./predictions-db');
        const resolved = historicalContext || (getAllPredictionsSync ? getAllPredictionsSync() : []);
        const verified = resolved.filter((p: Record<string, unknown>) => p.status === 'VERIFIED');
        const matches = verified.filter((p: Record<string, unknown>) => p.trend_regime === 'SIDEWAYS_MARKET' && p.volatility_regime === 'HIGH_VOLATILITY');
        if (matches.length > 5) {
          const acc = (matches.filter((p: Record<string, unknown>) => p.prediction_result === 'CORRECT').length / matches.length) * 100;
          if (acc > 55) proven = true;
        }
      } catch {}
    }
    if (!proven) {
      if (signalStrength === 'STRONG_SIGNAL') signalStrength = 'MODERATE_SIGNAL';
      else if (signalStrength === 'MODERATE_SIGNAL') signalStrength = 'WEAK_SIGNAL';
      else if (signalStrength === 'WEAK_SIGNAL') signalStrength = 'NO_SIGNAL';
    }
  }

  if (reliabilityDecision && reliabilityDecision.signalStrength === 'NO_SIGNAL') {
    signalStrength = 'NO_SIGNAL';
  }

  // Determine direction
  let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
  if (ensembleMetrics) {
    const mlConfidence = ensembleMetrics.finalProbability * 100;
    const decisiveML = 50 + (mlConfidence - 50) * 3;
    if (decisiveML > 55) direction = 'UP';
    else if (decisiveML < 45) direction = 'DOWN';
    else direction = 'NEUTRAL';
  } else {
    // Legacy heuristic approach
    if (baseConfidence > config.upThreshold && (ensemble.combined.bullish > ensemble.combined.bearish)) {
      direction = 'UP';
    } else if (baseConfidence < config.downThreshold || (ensemble.combined.bearish > ensemble.combined.bullish)) {
      direction = 'DOWN';
      baseConfidence = 100 - baseConfidence; 
    }
  }

  // If no signal or insufficient edge, override direction to NEUTRAL
  if (signalStrength === 'NO_SIGNAL') {
    direction = 'NEUTRAL';
  }

  // PRIORITY 10: MACRO CONTEXT ADJUSTMENT
  let macroAdjustedConfidence = finalConfidence;
  let hasMacroConflict = false;

  if (macroContext) {
    const macroRes = applySectorMacroSensitivity(sector || '', finalConfidence, macroContext);
    macroAdjustedConfidence = macroRes.confidence;
    hasMacroConflict = macroRes.conflict;

    if (direction === 'UP' && macroContext.macroBias === 'BEARISH') {
      hasMacroConflict = true;
      macroAdjustedConfidence -= 5;
    } else if (direction === 'DOWN' && macroContext.macroBias === 'BULLISH') {
      hasMacroConflict = true;
      macroAdjustedConfidence -= 5;
    }

    finalConfidence = Math.max(0, Math.min(100, macroAdjustedConfidence));
  }

  // ─── 9. Target Prices & Risk Metrics ───
  const targetLow = Number((price - atr14 * 2.0).toFixed(2));
  const targetHigh = Number((price + atr14 * 2.5).toFixed(2));

  let riskTier: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
  if (atrRatio < 0.015) riskTier = 'LOW';
  else if (atrRatio > 0.030) riskTier = 'HIGH';

  // Derive Probabilities
  const bullishProb = ensemble.combined.bullish;
  const bearishProb = ensemble.combined.bearish;
  const neutralProb = ensemble.combined.neutral;

  // Expected returns
  let timeframeDays = 7;
  if (timeframe === '1D') timeframeDays = 1;
  else if (timeframe === '30D') timeframeDays = 30;
  else if (timeframe === '90D') timeframeDays = 90;
  else if (timeframe === '365D') timeframeDays = 250;

  const timeframeVol = atrRatio * Math.sqrt(timeframeDays);

  let priceCoef = 0.04;
  if (timeframe === '1D') priceCoef = 0.015;
  else if (timeframe === '30D') priceCoef = 0.08;
  else if (timeframe === '90D') priceCoef = 0.15;
  else if (timeframe === '365D') priceCoef = 0.35;

  let predictedPrice = price;
  if (direction === 'UP') {
    predictedPrice = price * (1 + (confidence / 100) * priceCoef);
  } else if (direction === 'DOWN') {
    predictedPrice = price * (1 - (confidence / 100) * priceCoef);
  }
  predictedPrice = Number(predictedPrice.toFixed(2));

  const baseReturn = Number((((predictedPrice - price) / price) * 100).toFixed(1)) || (direction === 'NEUTRAL' ? 0.2 : 0);
  const bullReturn = Number((baseReturn + 1.64 * timeframeVol * 100).toFixed(1));
  const bearReturn = Number((baseReturn - 1.64 * timeframeVol * 100).toFixed(1));

  // ─── 10. AI Reasoning & Explanations ───
  const trendText = price > sma200 
    ? 'Solid long-term uptrend is supported by price sitting above the 200-day moving average.'
    : 'Caution is advised as price remains below the 200-day moving average, signaling long-term bearishness.';
  
  const momentumText = rsi14 > 75
    ? `RSI at ${rsi14} indicates overbought conditions, suggesting short-term consolidation.`
    : rsi14 < 30
    ? `RSI at ${rsi14} is oversold, hinting at a potential buying bounce.`
    : (macd && macd.histogram > 0)
    ? `Bullish MACD crossover aligns with healthy RSI of ${rsi14}.`
    : `Bearish MACD crossover aligns with RSI of ${rsi14}, signaling consolidation.`;

  const summary = `${trendText} ${momentumText}`;
  const directionText = direction === 'UP' ? 'bullish momentum' : direction === 'DOWN' ? 'bearish distribution' : 'sideways consolidation';
  
  let aiReasoningSummary = `Algorithmic analysis indicates ${directionText} for ${ticker} over the ${timeframe} horizon. Under the ${regimeClass.regime} regime, conviction is driven by Trend Strength (${trendPct}%) and Volume indicators (${volumePct}%), supported by RSI levels showing a contribution of ${rsiPct}%. consensus Agreement score is ${ensemble.agreementScore}%.`;
  if (ensembleMetrics) {
    aiReasoningSummary = `Ensemble meta-model analysis indicates ${directionText} for ${ticker} over the ${timeframe} horizon. XGBoost: ${(ensembleMetrics.xgbProbability*100).toFixed(0)}%, LightGBM: ${(ensembleMetrics.lgbProbability*100).toFixed(0)}%, RF: ${(ensembleMetrics.rfProbability*100).toFixed(0)}%, LR: ${(ensembleMetrics.lrProbability*100).toFixed(0)}%. Model Agreement Score: ${ensembleMetrics.modelAgreementScore}%.`;
  }

  // ─── 11. Data Quality & Source Gate ───
  const dataQuality = validateMarketData(history, price);
  const isSimulated = dataSource === 'mock' || dataSource === 'fallback';
  
  if (!dataQuality.isReliable || isSimulated) {
    confidence = Math.min(confidence, 55);
    riskTier = 'HIGH';
    
    if (signalStrength === 'STRONG_SIGNAL' || signalStrength === 'VERY_STRONG_SIGNAL' as any) {
      signalStrength = 'MODERATE_SIGNAL';
    }
    
    if (isSimulated) {
      aiReasoningSummary = `[WARNING: DEMO/FALLBACK DATA - Predictions are simulated] ` + aiReasoningSummary;
    } else {
      aiReasoningSummary = `[WARNING: LOW DATA QUALITY - ${dataQuality.warnings[0]}] ` + aiReasoningSummary;
    }
  }

  // ─── 12. Walk-Forward Accuracy Guardrail ───
  let wfAccuracyWarning = '';
  if (typeof window === 'undefined') {
    try {
      const { getWalkForwardMetrics } = require('./backtesting/data-cache');
      const wfMetrics = getWalkForwardMetrics(ticker);
      
      const getBucket = (conf: number) => {
        if (conf >= 90) return '90-100';
        if (conf >= 80) return '80-90';
        if (conf >= 70) return '70-80';
        if (conf >= 60) return '60-70';
        return '0-60';
      };

      const currentBucket = getBucket(confidence);
      
      const relevantMetrics = wfMetrics.filter((m: any) => 
        m.timeframe === timeframe && 
        m.regime === regimeClass.regime &&
        m.confidenceBucket === currentBucket
      );

      if (relevantMetrics.length > 0) {
        // Average the accuracy if multiple matches (usually just 1)
        const avgWfAcc = relevantMetrics.reduce((sum: number, m: any) => sum + m.accuracy, 0) / relevantMetrics.length;
        const totalWfTrades = relevantMetrics.reduce((sum: number, m: any) => sum + m.trades, 0);

        if (totalWfTrades >= 30 && avgWfAcc < 50) {
          confidence = Math.min(confidence, 55);
          riskTier = 'HIGH';
          if (signalStrength === 'STRONG_SIGNAL' || signalStrength === 'VERY_STRONG_SIGNAL' as any) {
            signalStrength = 'MODERATE_SIGNAL';
          }
          wfAccuracyWarning = `[WALK-FORWARD PENALTY: Historical out-of-sample accuracy for this segment is poor (${avgWfAcc.toFixed(1)}%). Confidence capped.] `;
        }
      } else {
        // Not enough validated history
        wfAccuracyWarning = `[WALK-FORWARD UNVALIDATED: Not enough validated history for this segment to confirm reliability.] `;
        confidence = Math.min(confidence, 75); // Cap at 75 if unvalidated
      }
    } catch {
      // Ignore if DB is not ready or not in node environment
    }
  }

  if (wfAccuracyWarning) {
    aiReasoningSummary = wfAccuracyWarning + aiReasoningSummary;
  }

  const result: PredictionResult = {
    ticker,
    direction,
    confidence,
    targetLow,
    targetHigh,
    riskTier,
    signalBreakdown: {
      trend: trendScore,
      momentum: Math.max(0, momentumScore),
      volatility: volatilityScore,
      volume: volumeScore,
    },
    summary,
    generatedAt: new Date().toISOString(),
    modelVersion,
    
    // Extracted Properties
    probabilities: {
      bullish: bullishProb,
      bearish: bearishProb,
      neutral: neutralProb,
    },
    expectedReturns: {
      bear: bearReturn,
      base: baseReturn,
      bull: bullReturn,
    },
    riskScore: ensemble.riskScore,
    volatilityScore: Math.min(10, Math.max(1, Math.round(atrRatio * 100 * 3.5))),
    explainability: {
      rsiContribution: rsiPct,
      macdContribution: macdPct,
      trendContribution: trendPct,
      volumeContribution: volumePct,
      volatilityContribution: volPct,
      sentimentContribution: sentimentPct,
      supportResistanceContribution: supportResistancePct,
      aiReasoningSummary,
    },
    // Map to defined interface properties
    similarSetup: similarAccuracy !== undefined && similarCount !== undefined ? {
      successRate: similarAccuracy,
      verifiedCount: similarCount,
    } : undefined,
    regime: regimeClass.regime,
    trendRegime: newMarketRegime.trendRegime,
    volatilityRegime: newMarketRegime.volatilityRegime,
    regimeConfidence: newMarketRegime.regimeConfidence,
    regimeReason: newMarketRegime.regimeReason,
    regimeAdjustedConfidence: finalConfidence,
    signalStrength,
    reliabilityGrade: reliabilityDecision?.reliabilityGrade,
    reliabilityWarnings: reliabilityDecision?.warnings,
    confidenceBeforeFilter: rawConfidence,
    dataQualityScore: dataQuality.score,
    confidenceAfterFilter: confidence,
    signalQuality: signalStrength,
    filterReason: reliabilityDecision?.warnings.join('; '),
    isTradeableSignal: false,
    maxPositionSize: 0,
    stockReliabilityScore: reliabilityDecision?.breakdown.ticker.accuracy,
    timeframeReliabilityScore: reliabilityDecision?.breakdown.timeframe.accuracy,
    insufficientEdge: signalStrength === 'NO_SIGNAL',
  };

  // Trade Filter Engine Logic
  const riskScore = macroContext ? macroContext.macroRiskScore : 50; // Dynamic risk score
  const volumeQuality = Math.min(100, Math.round((indicators.avgVolume20 && indicators.avgVolume20 > 0 ? volume / indicators.avgVolume20 : 1) * 50));
  
  const tfInput: TradeFilterInput = {
    signalType: signalStrength,
    calibratedConfidence: finalConfidence,
    alignmentScore: alignmentScore,
    timeframeConflict: rawFeatures && rawFeatures.timeframeConflict ? true : false,
    marketRegime: {
      trendRegime: newMarketRegime.trendRegime,
      volatilityRegime: newMarketRegime.volatilityRegime
    },
    riskScore: riskScore,
    volumeQuality,
    historicalStockAccuracy: reliabilityDecision?.breakdown.ticker.accuracy,
    historicalSectorAccuracy: 50, // default
    hasActualComparisonTarget: true,
    hasDataQualityWarning: false
  };

  const defaultThresholds: TradeFilterThresholds = {
    minConfidence: 65,
    minAlignment: 65,
    minTradeFilterScore: 65,
    maxRiskScore: 80
  };

  const tradeFilterOutput = evaluateTradeability(tfInput, tradeFilterThresholds || defaultThresholds);
  
  result.isTradeableSignal = tradeFilterOutput.isTradeable;
  result.tradeFilterScore = tradeFilterOutput.tradeFilterScore;
  result.tradeFilterDecision = tradeFilterOutput.tradeFilterDecision;
  result.rejectionReasons = tradeFilterOutput.rejectionReasons;

  result.maxPositionSize = (() => {
    if (!result.isTradeableSignal) return 0.0;
    
    let poorEdge = false;
    let tickerAcc = 50;
    if (reliabilityDecision) {
      tickerAcc = reliabilityDecision.breakdown.ticker.accuracy;
      if (typeof tickerAcc === 'number' && tickerAcc < 55) poorEdge = true;
    }
    
    if (poorEdge) {
      result.insufficientEdge = true;
      result.reliabilityWarnings = [...(result.reliabilityWarnings || []), 'Poor historical edge (<55% accuracy)'];
      return 0.0;
    }
    
    let posSize = 5.0; // max 5% by default
    if (signalStrength === 'MODERATE_SIGNAL') posSize = 2.5;
    if (signalStrength === 'WEAK_SIGNAL') posSize = 1.0;
    
    if (newMarketRegime.trendRegime === 'BEAR_MARKET') posSize *= 0.5;
    if (newMarketRegime.volatilityRegime === 'HIGH_VOLATILITY') posSize *= 0.5;

    // Throttle dynamically via historical ticker reliability (no hardcoded overrides)
    if (typeof tickerAcc === 'number') {
      if (tickerAcc < 60) posSize *= 0.5;
      else if (tickerAcc > 75) posSize *= 1.25;
    }
    
    // Penalize size if macro risk is too high or if there's conflict
    if (hasMacroConflict) posSize *= 0.5;
    if (riskScore > 70) posSize *= 0.5;
    
    return Number(Math.min(10.0, Math.max(0.5, posSize)).toFixed(1));
  })();

  if (result.maxPositionSize === 0.0 && result.isTradeableSignal) {
    result.insufficientEdge = true;
    result.isTradeableSignal = false; // Override flag
    result.rejectionReasons = [...(result.rejectionReasons || []), 'LOW_HISTORICAL_STOCK_ACCURACY'];
  }

  if (macroContext) {
    result.macroContext = {
      riskScore: macroContext.macroRiskScore,
      bias: macroContext.macroBias,
      niftyTrend: macroContext.niftyTrend,
      niftyStrength: macroContext.niftyStrength,
      vixLevel: macroContext.vixLevel
    };
  }

  return result;
}
