import { TuningConfig } from './prediction-engine';
import { MarketRegime } from './regime-detector';

export interface RegimeMultipliers {
  trend: number;      // multiplier for SMA/EMA weights
  momentum: number;   // multiplier for RSI/MACD/Stochastic weights
  volatility: number; // multiplier for Bollinger weights
  volume: number;     // multiplier for volume weight
}

export const REGIME_MULTIPLIERS: Record<MarketRegime, RegimeMultipliers> = {
  BULL_TREND: { trend: 1.5, momentum: 1.3, volatility: 0.7, volume: 1.0 },
  BEAR_TREND: { trend: 1.0, momentum: 0.5, volatility: 1.5, volume: 1.3 },
  SIDEWAYS_CHOPPY: { trend: 0.5, momentum: 1.5, volatility: 1.5, volume: 0.7 },
  HIGH_VOLATILITY: { trend: 0.5, momentum: 0.5, volatility: 2.0, volume: 1.5 },
  LOW_LIQUIDITY: { trend: 0.5, momentum: 1.0, volatility: 0.5, volume: 2.0 },
  RECOVERY_REVERSAL: { trend: 0.5, momentum: 2.0, volatility: 1.5, volume: 1.0 },
};

/**
 * Applies regime-specific multipliers to the tuning config, rounding to integers,
 * while ensuring that penalties remain negative.
 */
export function applyRegimeMultipliers(config: TuningConfig, regime: MarketRegime): TuningConfig {
  const multipliers = REGIME_MULTIPLIERS[regime];
  if (!multipliers) return config;

  const t = multipliers.trend;
  const m = multipliers.momentum;
  const v = multipliers.volatility;
  const vol = multipliers.volume;

  // Trend weights
  const weightSma200 = Math.round(config.weightSma200 * t);
  const weightSma50 = Math.round(config.weightSma50 * t);
  const weightSma20 = Math.round(config.weightSma20 * t);
  const weightEmaCross = Math.round(config.weightEmaCross * t);

  // Momentum weights
  const weightRsiBullish = Math.round(config.weightRsiBullish * m);
  const penaltyRsiOversold = -Math.round(Math.abs(config.penaltyRsiOversold) * m);
  const penaltyRsiOverbought = -Math.round(Math.abs(config.penaltyRsiOverbought) * m);
  const weightMacd = Math.round(config.weightMacd * m);
  const weightStochastic = Math.round(config.weightStochastic * m);
  const weightWilliamsR = Math.round(config.weightWilliamsR * m);

  // Volatility weights
  const weightBbandMiddle = Math.round(config.weightBbandMiddle * v);
  const weightBbandUpper = Math.round(config.weightBbandUpper * v);

  // Volume weight
  const weightVolume = Math.round(config.weightVolume * vol);

  return {
    weightSma200,
    weightSma50,
    weightSma20,
    weightEmaCross,
    weightRsiBullish,
    penaltyRsiOversold,
    penaltyRsiOverbought,
    weightMacd,
    weightStochastic,
    weightWilliamsR,
    weightBbandMiddle,
    weightBbandUpper,
    weightVolume,
    upThreshold: config.upThreshold,
    downThreshold: config.downThreshold,
  };
}
