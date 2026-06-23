/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FeatureMetrics {
  featureName: string;
  condition: string;
  sampleSize: number;
  winCount: number;
  lossCount: number;
  directionalAccuracy: number;
  averageReturnImpact: number;
  status: 'LEARNING' | 'BOOSTED' | 'PENALIZED' | 'NEUTRAL';
}

export interface FeaturePerformanceReport {
  features: Record<string, FeatureMetrics>;
  lastUpdated: string;
}

export function analyzeFeaturePerformance(verifiedPredictions: any[]): FeaturePerformanceReport {
  const metrics: Record<string, FeatureMetrics> = {};

  const registerFeature = (key: string, conditionName: string) => {
    if (!metrics[key]) {
      metrics[key] = {
        featureName: key,
        condition: conditionName,
        sampleSize: 0,
        winCount: 0,
        lossCount: 0,
        directionalAccuracy: 0,
        averageReturnImpact: 0,
        status: 'LEARNING'
      };
    }
  };

  const featureKeys = [
    { key: 'trendStrengthBullish', condition: 'trendStrength > 0.6' },
    { key: 'trendStrengthBearish', condition: 'trendStrength < 0.2' },
    { key: 'alignmentBullish', condition: 'alignmentScore > 75' },
    { key: 'alignmentBearish', condition: 'alignmentScore < 40' },
    { key: 'rsiDivergenceBullish', condition: 'rsiDivergence > 0' },
    { key: 'rsiDivergenceBearish', condition: 'rsiDivergence < 0' },
    { key: 'breakoutContext', condition: 'breakoutVsMeanReversion > 0' },
    { key: 'volumeConfirmationBullish', condition: 'volumeConfirmationScore > 0' },
    { key: 'volumeConfirmationBearish', condition: 'volumeConfirmationScore < 0' },
  ];

  featureKeys.forEach(fk => registerFeature(fk.key, fk.condition));

  verifiedPredictions.forEach(pred => {
    if (!pred.smart_features) return;
    const sf = pred.smart_features;
    
    const actualDirection = pred.actual_direction;
    const returnImpact = Math.abs(pred.error_percentage || 0);
    
    const evaluate = (key: string, active: boolean, expectedBias: 'UP' | 'DOWN' | 'ANY') => {
      if (active) {
        metrics[key].sampleSize++;
        metrics[key].averageReturnImpact += returnImpact;
        
        let isWin = false;
        if (expectedBias === 'ANY') {
          isWin = pred.prediction_result === 'CORRECT';
        } else {
          isWin = actualDirection === expectedBias;
        }

        if (isWin) {
          metrics[key].winCount++;
        } else {
          metrics[key].lossCount++;
        }
      }
    };

    evaluate('trendStrengthBullish', sf.trendStrength > 0.6, 'UP');
    evaluate('trendStrengthBearish', sf.trendStrength < 0.2, 'DOWN');
    evaluate('alignmentBullish', sf.alignmentScore > 75, 'UP');
    evaluate('alignmentBearish', sf.alignmentScore < 40, 'DOWN');
    evaluate('rsiDivergenceBullish', sf.rsiDivergence > 0, 'UP');
    evaluate('rsiDivergenceBearish', sf.rsiDivergence < 0, 'DOWN');
    evaluate('breakoutContext', sf.breakoutVsMeanReversion > 0, 'ANY');
    evaluate('volumeConfirmationBullish', sf.volumeConfirmationScore > 0, 'UP');
    evaluate('volumeConfirmationBearish', sf.volumeConfirmationScore < 0, 'DOWN');
  });

  Object.values(metrics).forEach(m => {
    if (m.sampleSize > 0) {
      m.directionalAccuracy = Number(((m.winCount / m.sampleSize) * 100).toFixed(2));
      m.averageReturnImpact = Number((m.averageReturnImpact / m.sampleSize).toFixed(2));
    }
    
    if (m.sampleSize >= 20) {
      if (m.directionalAccuracy > 60) {
        m.status = 'BOOSTED';
      } else if (m.directionalAccuracy < 45) {
        m.status = 'PENALIZED';
      } else {
        m.status = 'NEUTRAL';
      }
    } else {
      m.status = 'LEARNING';
    }
  });

  return {
    features: metrics,
    lastUpdated: new Date().toISOString()
  };
}

export function getFeaturePerformanceReportSync(): FeaturePerformanceReport | null {
  try {
    const { getAllPredictionsSync } = require('./predictions-db');
    if (getAllPredictionsSync) {
      const allPredictions = getAllPredictionsSync();
      const verified = allPredictions.filter((p: any) => p.status === 'VERIFIED');
      if (verified.length > 0) {
        return analyzeFeaturePerformance(verified);
      }
    }
  } catch (err) {
    // ignore
  }
  return null;
}
