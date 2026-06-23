import { LogisticRegression, RandomForest, GradientBoosting, Vector, Matrix } from './ml-core';
import { SmartFeatures } from './featureEngineering';

export type EnsembleMethod = 'SIMPLE_AVERAGE' | 'WEIGHTED_AVERAGE' | 'STACKED_META_MODEL';

export interface BaseModels {
  xgboost: GradientBoosting;
  lightgbm: GradientBoosting;
  randomForest: RandomForest;
  logisticRegression: LogisticRegression;
}

export interface EnsembleMetrics {
  xgbProbability: number;
  lgbProbability: number;
  rfProbability: number;
  lrProbability: number;
  finalProbability: number;
  modelAgreementScore: number;
}

// ---------------------------------------------------------
// Helper: Convert SmartFeatures to Flat Vector
// ---------------------------------------------------------
export const FEATURE_NAMES = [
  'trendStrength', 'trendDuration', 'emaDistance20', 'emaDistance50', 'emaDistance200', 
  'emaSlope20', 'emaSlope50', 'emaSlope200', 'atrExpansion', 'atrCompressionPercentile', 
  'rollingVolatility20', 'rollingVolatility50', 'volatilityPercentile100', 'relativeVolume', 
  'volumeAcceleration', 'volumeConfirmationScore', 'indexStrength', 'sectorStrength', 
  'relativePerformance5', 'relativePerformance20', 'relativePerformance60', 'higherTimeframeTrend', 
  'higherTimeframeStrength', 'alignmentScore', 'timeframeConflict'
];

export function featuresToVector(features: SmartFeatures): Vector {
  const vec = [
    features.trendStrength || 0,
    features.trendDuration || 0,
    features.emaDistance20 || 0,
    features.emaDistance50 || 0,
    features.emaDistance200 || 0,
    features.emaSlope20 || 0,
    features.emaSlope50 || 0,
    features.emaSlope200 || 0,
    features.atrExpansion || 0,
    features.atrCompressionPercentile || 0,
    features.rollingVolatility20 || 0,
    features.rollingVolatility50 || 0,
    features.volatilityPercentile100 || 0,
    features.relativeVolume || 0,
    features.volumeAcceleration || 0,
    features.volumeConfirmationScore || 0,
    features.indexStrength || 0,
    features.sectorStrength || 0,
    features.relativePerformance5 || 0,
    features.relativePerformance20 || 0,
    features.relativePerformance60 || 0,
    features.higherTimeframeTrend || 0,
    features.higherTimeframeStrength || 0,
    features.alignmentScore || 0,
    features.timeframeConflict || 0
  ];

  // Map categorical values
  // higherTimeframeTrend is already mapped to 1, -1, 0
  
  // Priority 10: Append Macro features
  vec.push(
    features.macroNiftyStrength || 50,
    features.macroBankNiftyStrength || 50,
    features.macroVixLevel || 15,
    features.macroVixPercentile || 50,
    features.macroInterestRateTrend || 0,
    features.macroUsdInrTrend || 0,
    features.macroRiskScore || 50
  );

  return vec;
}

// ---------------------------------------------------------
// Engine Orchestrator
// ---------------------------------------------------------
export class EnsemblePredictionEngine {
  baseModels?: BaseModels;
  metaModel?: LogisticRegression;
  featureImportances: Record<string, number> = {};
  methodWeights: number[] = [0.25, 0.25, 0.25, 0.25];

  // Train the base models and optional meta model
  trainEnsemble(X: Matrix, y: Vector) {
    // 1. Initialize models with different hyperparameter profiles
    const xgboost = new GradientBoosting(25, 0.1, 4);    // Deeper trees, slower learning rate
    const lightgbm = new GradientBoosting(15, 0.2, 3);   // Shallower, faster rate
    const randomForest = new RandomForest(15, 4);
    const logisticRegression = new LogisticRegression(0.05, 50);

    // 2. Train Base Models
    xgboost.train(X, y);
    lightgbm.train(X, y);
    randomForest.train(X, y);
    logisticRegression.train(X, y);

    this.baseModels = { xgboost, lightgbm, randomForest, logisticRegression };

    // 3. Train Meta Model for STACKED_META_MODEL
    const metaX: Matrix = [];
    for (let i = 0; i < X.length; i++) {
      metaX.push([
        xgboost.predictProba(X[i]),
        lightgbm.predictProba(X[i]),
        randomForest.predictProba(X[i]),
        logisticRegression.predictProba(X[i])
      ]);
    }
    this.metaModel = new LogisticRegression(0.1, 100);
    this.metaModel.train(metaX, y);

    // 4. Calculate Aggregate Feature Importance
    this.featureImportances = {};
    for (let i = 0; i < FEATURE_NAMES.length; i++) {
      const importance = 
        (xgboost.featureImportance[i] || 0) * 0.4 + 
        (lightgbm.featureImportance[i] || 0) * 0.4 + 
        (randomForest.featureImportance[i] || 0) * 0.2;
      this.featureImportances[FEATURE_NAMES[i]] = importance;
    }
  }

  // Generate Prediction
  predictEnsemble(features: SmartFeatures, method: EnsembleMethod = 'SIMPLE_AVERAGE'): EnsembleMetrics {
    if (!this.baseModels) {
      throw new Error("Ensemble Engine not trained.");
    }

    const x = featuresToVector(features);

    // Get base probabilities
    const xgbProb = this.baseModels.xgboost.predictProba(x);
    const lgbProb = this.baseModels.lightgbm.predictProba(x);
    const rfProb = this.baseModels.randomForest.predictProba(x);
    const lrProb = this.baseModels.logisticRegression.predictProba(x);

    const probs = [xgbProb, lgbProb, rfProb, lrProb];
    
    // Model Agreement Score (standard deviation inversely mapped)
    const meanProb = probs.reduce((a,b)=>a+b, 0) / 4;
    const variance = probs.reduce((acc, p) => acc + Math.pow(p - meanProb, 2), 0) / 4;
    const stdDev = Math.sqrt(variance);
    // Max theoretical stdDev for [0,1] is 0.5 (e.g. 0, 0, 1, 1). Map 0 stdDev -> 100 agreement, 0.5 stdDev -> 0
    const agreementScore = Math.max(0, Math.min(100, 100 - (stdDev * 200)));

    let finalProbability = meanProb;

    if (method === 'WEIGHTED_AVERAGE') {
      finalProbability = 
        xgbProb * this.methodWeights[0] + 
        lgbProb * this.methodWeights[1] + 
        rfProb * this.methodWeights[2] + 
        lrProb * this.methodWeights[3];
    } else if (method === 'STACKED_META_MODEL' && this.metaModel) {
      finalProbability = this.metaModel.predictProba(probs);
    }

    return {
      xgbProbability: xgbProb,
      lgbProbability: lgbProb,
      rfProbability: rfProb,
      lrProbability: lrProb,
      finalProbability,
      modelAgreementScore: Math.round(agreementScore)
    };
  }

  // Retrieve top features
  getTopFeatures(n: number = 20): Array<{feature: string, importance: number}> {
    return Object.entries(this.featureImportances)
      .map(([feature, importance]) => ({ feature, importance }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, n);
  }
}
