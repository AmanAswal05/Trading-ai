import { TechnicalIndicators } from '../types/stock';

export interface EngineOutput {
  name: string;
  bullish: number;   // 0-100 probability
  bearish: number;   // 0-100 probability  
  neutral: number;   // 0-100 probability (sum = 100)
  weight: number;    // engine importance weight (0-1)
  confidence: number; // how confident this engine is in its call (0-100)
}

export interface MetaModelOutput {
  engines: EngineOutput[];
  combined: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  finalDirection: 'UP' | 'DOWN' | 'NEUTRAL';
  finalConfidence: number;
  riskScore: number;        // 1-10
  agreementScore: number;   // 0-100, how much engines agree
}

// ─── Sub-Engines ─────────────────────────────────────────────────────────────

// 1. Trend Engine (Weight: 0.25)
function runTrendEngine(indicators: TechnicalIndicators, price: number): EngineOutput {
  const { sma20, sma50, sma200, ema12, ema26 } = indicators;
  
  let bullishSignals = 0;
  let bearishSignals = 0;
  
  if (price > sma200) bullishSignals++; else bearishSignals++;
  if (price > sma50) bullishSignals++; else bearishSignals++;
  if (price > sma20) bullishSignals++; else bearishSignals++;
  if (ema12 > ema26) bullishSignals++; else bearishSignals++;

  let bullish = 33;
  let bearish = 33;
  let neutral = 34;
  let confidence = 50;

  if (bullishSignals === 4) {
    bullish = 85; bearish = 5; neutral = 10; confidence = 90;
  } else if (bullishSignals === 3) {
    bullish = 65; bearish = 15; neutral = 20; confidence = 70;
  } else if (bearishSignals === 4) {
    bullish = 5; bearish = 85; neutral = 10; confidence = 90;
  } else if (bearishSignals === 3) {
    bullish = 15; bearish = 65; neutral = 20; confidence = 70;
  } else {
    neutral = 60; bullish = 20; bearish = 20; confidence = 50;
  }

  return { name: 'Trend Engine', bullish, bearish, neutral, weight: 0.25, confidence };
}

// 2. Momentum Engine (Weight: 0.25)
function runMomentumEngine(indicators: TechnicalIndicators): EngineOutput {
  const { rsi14, macd, stochasticK, stochasticD, williamsR } = indicators;

  let bullishSignals = 0;
  let bearishSignals = 0;

  // RSI
  if (rsi14 > 50 && rsi14 < 70) bullishSignals++;
  if (rsi14 > 75) bearishSignals++; // overbought
  if (rsi14 < 30) bullishSignals++; // oversold bounce expectation, but technically momentum is bearish

  // MACD
  if (macd && macd.histogram > 0) bullishSignals++; else bearishSignals++;

  // Stochastic
  if (stochasticK > stochasticD) bullishSignals++; else bearishSignals++;

  // Williams %R
  if (williamsR > -50) bullishSignals++; else bearishSignals++;

  let bullish = 33;
  let bearish = 33;
  let neutral = 34;
  let confidence = 50;

  if (bullishSignals >= 3) {
    bullish = 75; bearish = 10; neutral = 15; confidence = 75;
  } else if (bearishSignals >= 3) {
    bullish = 10; bearish = 75; neutral = 15; confidence = 75;
  } else {
    neutral = 50; bullish = 25; bearish = 25; confidence = 50;
  }

  return { name: 'Momentum Engine', bullish, bearish, neutral, weight: 0.25, confidence };
}

// 3. Volatility Engine (Weight: 0.15)
function runVolatilityEngine(indicators: TechnicalIndicators, price: number): EngineOutput {
  const { bollingerUpper, bollingerMiddle, bollingerLower, atr14 } = indicators;

  const bbandRange = bollingerUpper - bollingerLower;
  const pctB = bbandRange > 0 ? (price - bollingerLower) / bbandRange : 0.5;

  let bullish = 33;
  let bearish = 33;
  let neutral = 34;
  let confidence = 50;

  if (pctB > 0.8) {
    // Overextended upper band
    bullish = 15; bearish = 65; neutral = 20; confidence = 70;
  } else if (pctB < 0.2) {
    // Overextended lower band
    bullish = 65; bearish = 15; neutral = 20; confidence = 70;
  } else if (price > bollingerMiddle) {
    // Mid to high range, positive drift
    bullish = 55; bearish = 20; neutral = 25; confidence = 55;
  } else {
    bullish = 20; bearish = 55; neutral = 25; confidence = 55;
  }

  return { name: 'Volatility Engine', bullish, bearish, neutral, weight: 0.15, confidence };
}

// 4. Volume Engine (Weight: 0.15)
function runVolumeEngine(indicators: TechnicalIndicators, volume: number, avgVolume20: number): EngineOutput {
  const volRatio = volume / (avgVolume20 || 1);
  const rsi = indicators.rsi14;

  let bullish = 33;
  let bearish = 33;
  let neutral = 34;
  let confidence = 50;

  if (volRatio > 1.3) {
    // High volume confirms direction
    if (rsi > 50) {
      bullish = 70; bearish = 10; neutral = 20; confidence = 80;
    } else {
      bullish = 10; bearish = 70; neutral = 20; confidence = 80;
    }
  } else if (volRatio < 0.7) {
    // Low volume suggests consolidation
    neutral = 70; bullish = 15; bearish = 15; confidence = 65;
  } else {
    neutral = 45; bullish = 27; bearish = 28; confidence = 50;
  }

  return { name: 'Volume Engine', bullish, bearish, neutral, weight: 0.15, confidence };
}

// 5. Mean Reversion Engine (Weight: 0.20)
function runMeanReversionEngine(indicators: TechnicalIndicators, price: number): EngineOutput {
  const { rsi14, bollingerUpper, bollingerLower } = indicators;

  let bullish = 33;
  let bearish = 33;
  let neutral = 34;
  let confidence = 50;

  // Look for extremes
  const isOversold = rsi14 < 30 || price <= bollingerLower;
  const isOverbought = rsi14 > 70 || price >= bollingerUpper;

  if (isOversold) {
    // Buy signals for bounce
    bullish = 80; bearish = 5; neutral = 15; confidence = 85;
  } else if (isOverbought) {
    // Sell signals for pullback
    bullish = 5; bearish = 80; neutral = 15; confidence = 85;
  } else {
    // Neutral in normal ranges
    neutral = 80; bullish = 10; bearish = 10; confidence = 60;
  }

  return { name: 'Mean Reversion Engine', bullish, bearish, neutral, weight: 0.20, confidence };
}

// ─── Main Ensemble Function ─────────────────────────────────────────────────

export function runMetaModel(
  indicators: TechnicalIndicators,
  price: number,
  volume: number,
  avgVolume20: number
): MetaModelOutput {
  const engines = [
    runTrendEngine(indicators, price),
    runMomentumEngine(indicators),
    runVolatilityEngine(indicators, price),
    runVolumeEngine(indicators, volume, avgVolume20),
    runMeanReversionEngine(indicators, price),
  ];

  // Combine using weighted averages
  let weightedBullish = 0;
  let weightedBearish = 0;
  let weightedNeutral = 0;
  let totalWeight = 0;

  for (const eng of engines) {
    weightedBullish += eng.bullish * eng.weight;
    weightedBearish += eng.bearish * eng.weight;
    weightedNeutral += eng.neutral * eng.weight;
    totalWeight += eng.weight;
  }

  let bullish = Math.round(weightedBullish / totalWeight);
  let bearish = Math.round(weightedBearish / totalWeight);
  let neutral = Math.round(weightedNeutral / totalWeight);

  // Normalize to 100
  const sum = bullish + bearish + neutral;
  if (sum !== 100) {
    const diff = 100 - sum;
    neutral += diff; // adjust neutral slightly
  }

  // Determine final direction and confidence
  let finalDirection: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
  let finalConfidence = neutral;

  if (bullish > bearish && bullish > neutral) {
    finalDirection = 'UP';
    finalConfidence = bullish;
  } else if (bearish > bullish && bearish > neutral) {
    finalDirection = 'DOWN';
    finalConfidence = bearish;
  }

  // Agreement Score (how many engines align on direction)
  let matchingDirectionCount = 0;
  for (const eng of engines) {
    const engDir = eng.bullish > eng.bearish && eng.bullish > eng.neutral
      ? 'UP'
      : eng.bearish > eng.bullish && eng.bearish > eng.neutral
      ? 'DOWN'
      : 'NEUTRAL';
    if (engDir === finalDirection) {
      matchingDirectionCount++;
    }
  }
  const agreementScore = Math.round((matchingDirectionCount / engines.length) * 100);

  // Risk Score (1-10)
  const atrRatio = indicators.atr14 / price;
  const volRisk = Math.min(10, Math.max(1, Math.round(atrRatio * 100 * 3.5)));
  const consensusRisk = Math.round((100 - agreementScore) / 10);
  const riskScore = Math.min(10, Math.max(1, Math.round(volRisk * 0.6 + consensusRisk * 0.4)));

  return {
    engines,
    combined: {
      bullish,
      bearish,
      neutral,
    },
    finalDirection,
    finalConfidence,
    riskScore,
    agreementScore,
  };
}
