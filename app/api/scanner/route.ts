import { NextRequest, NextResponse } from 'next/server';
import { getStockDataInternal } from '@/lib/stock-service';
import { SCANNER_UNIVERSE_30 } from '@/lib/scanner-universe';
import { generatePrediction } from '@/lib/prediction-engine';
import { detectMarketPattern } from '@/lib/pattern-recognition';
import { calculateSupportResistanceLevels } from '@/lib/support-resistance';
import { detectMarketRegime } from '@/lib/market-regime';
import { calculateMultiTimeframeConfirmation } from '@/lib/multi-timeframe';
import { getSectorForStock, getIndexForSector } from '@/lib/sector-map';
import { calculateSectorStrength, SectorStrength, SectorClassification } from '@/lib/sector-rotation';
import { calculateRelativeStrength, RSClassification, RelativeStrengthResult } from '@/lib/relative-strength';
import { calculateVolumeIntelligence, VolumeClassification, VolumeResult } from '@/lib/institutional-volume';

export const revalidate = 0; // Dynamic route, we handle caching manually if needed

const scannerCache: Record<string, { data: any, timestamp: number }> = {};

function validateTradePlan({
  direction,
  entry,
  stopLoss,
  target,
  riskReward,
  atr
}: {
  direction: string;
  entry: number;
  stopLoss: number;
  target: number;
  riskReward: number;
  atr: number;
}) {
  const reasons: string[] = [];
  let valid = true;

  if (direction === 'UP') {
    if (!(stopLoss < entry && entry < target)) {
      valid = false;
      reasons.push("Invalid trade structure");
    }
  } else if (direction === 'DOWN') {
    if (!(target < entry && entry < stopLoss)) {
      valid = false;
      reasons.push("Invalid trade structure");
    }
  }

  const riskPercent = Math.abs(entry - stopLoss) / entry * 100;
  const rewardPercent = Math.abs(target - entry) / entry * 100;

  if (riskPercent < 0.5) {
    valid = false;
    reasons.push("Risk distance too small");
  }
  if (rewardPercent < 1.0) {
    valid = false;
    reasons.push("Reward distance too small");
  }

  if (riskReward < 1.5) {
    valid = false;
    reasons.push("Risk reward too low");
  } else if (riskReward > 8) {
    valid = false;
    reasons.push("Risk reward unrealistically high");
  }

  const riskATR = Math.abs(entry - stopLoss) / atr;

  if (riskATR < 0.3) {
    valid = false;
    reasons.push("Stop too close to price");
  } else if (riskATR > 5) {
    valid = false;
    reasons.push("Stop too far from price");
  }

  return {
    valid,
    reasons,
    shouldFallbackToATR: !valid
  };
}

function calculateOpportunityScore({
  pattern,
  patternStrength,
  patternConfidence,
  breakoutStatus,
  confidence,
  riskReward,
  tradeStatus,
  finalDirection,
  consistency,
  hasValidTradePlan
}: {
  pattern: string;
  patternStrength: number;
  patternConfidence: number;
  breakoutStatus: string;
  confidence: number;
  riskReward: number;
  tradeStatus: string;
  finalDirection: string;
  consistency: string;
  hasValidTradePlan: boolean;
}) {
  let breakoutQuality = 45;
  if (breakoutStatus === 'BREAKOUT_CONFIRMED') breakoutQuality = 100;
  else if (breakoutStatus === 'NEAR_BREAKOUT') breakoutQuality = 80;
  else if (breakoutStatus === 'FAILED_BREAKOUT') breakoutQuality = 10;

  let patternQuality = 60;
  if (patternStrength > 0) {
    patternQuality = patternStrength;
  } else {
    if (pattern === 'No Clear Pattern') patternQuality = 10;
    else if (pattern === 'Support Bounce') patternQuality = 70;
    else if (pattern === 'Volume Breakout') patternQuality = 75;
    else if (pattern === 'Range Breakout') patternQuality = 65;
    else if (pattern === 'Double Top' || pattern === 'Double Bottom') patternQuality = 70;
  }

  const confidenceQuality = confidence;

  let riskRewardQuality = 0;
  if (hasValidTradePlan && riskReward !== null) {
    if (riskReward < 1.5) riskRewardQuality = 20;
    else if (riskReward < 2) riskRewardQuality = 70;
    else if (riskReward < 3) riskRewardQuality = 90;
    else riskRewardQuality = 100;
  }

  let consistencyQuality = 0;
  if (consistency === 'CONFIRMED') consistencyQuality = 100;
  else if (consistency === 'WEAK') consistencyQuality = 60;

  let tradeabilityQuality = 30;
  if (tradeStatus === 'TRADEABLE') tradeabilityQuality = 100;

  let opportunityScore = 
    breakoutQuality * 0.25 +
    patternQuality * 0.20 +
    confidenceQuality * 0.20 +
    riskRewardQuality * 0.15 +
    consistencyQuality * 0.10 +
    tradeabilityQuality * 0.10;

  opportunityScore = Math.max(0, Math.min(100, Math.round(opportunityScore)));

  return {
    opportunityScore,
    breakoutQuality,
    patternQuality,
    confidenceQuality,
    riskRewardQuality,
    consistencyQuality,
    tradeabilityQuality
  };
}

function evaluateTradeabilityV2({
  confidence,
  opportunityScore,
  riskReward,
  hasValidTradePlan,
  pattern,
  breakoutStatus,
  regime,
  direction,
  multiTimeframeScore,
  sectorClassification,
  rsClassification,
  volumeClassification,
  extraReasons = []
}: {
  confidence: number;
  opportunityScore: number;
  riskReward: number;
  hasValidTradePlan: boolean;
  pattern: string;
  breakoutStatus: string;
  regime: 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR';
  direction: string;
  multiTimeframeScore: number;
  sectorClassification?: SectorClassification;
  rsClassification?: RSClassification;
  volumeClassification?: VolumeClassification;
  extraReasons?: string[];
}) {
  const allowedPatterns = [
    'Cup and Handle', 'Double Bottom', 'Bull Flag', 'Ascending Triangle',
    'Support Bounce', 'Moving Average Pullback', 'Volume Breakout',
    'Double Top', 'Bear Flag', 'Descending Triangle', 'Resistance Rejection'
  ];
  const allowedBreakouts = ['BREAKOUT_CONFIRMED', 'NEAR_BREAKOUT', 'SUPPORT_BOUNCE', 'PULLBACK', 'WATCHING'];

  let bqWeight = 0;
  if (breakoutStatus === 'BREAKOUT_CONFIRMED') bqWeight = 100;
  else if (breakoutStatus === 'NEAR_BREAKOUT') bqWeight = 85;
  else if (breakoutStatus === 'SUPPORT_BOUNCE') bqWeight = 80;
  else if (breakoutStatus === 'PULLBACK') bqWeight = 75;
  else if (breakoutStatus === 'WATCHING') bqWeight = 65;
  else if (breakoutStatus === 'FAILED_BREAKOUT') bqWeight = 0;

  let pqWeight = 30;
  switch(pattern) {
    case 'Cup and Handle': pqWeight = 100; break;
    case 'Double Bottom': pqWeight = 95; break;
    case 'Bull Flag': pqWeight = 95; break;
    case 'Ascending Triangle': pqWeight = 92; break;
    case 'Support Bounce': pqWeight = 90; break;
    case 'Moving Average Pullback': pqWeight = 88; break;
    case 'Volume Breakout': pqWeight = 85; break;
    case 'Double Top': pqWeight = 85; break;
    case 'Bear Flag': pqWeight = 90; break;
    case 'Descending Triangle': pqWeight = 90; break;
    case 'Resistance Rejection': pqWeight = 88; break;
  }

  let riskRewardScore = 0;
  if (riskReward >= 3) riskRewardScore = 100;
  else if (riskReward >= 2.5) riskRewardScore = 90;
  else if (riskReward >= 2) riskRewardScore = 80;
  else if (riskReward >= 1.8) riskRewardScore = 70;
  else if (riskReward >= 1.5) riskRewardScore = 50;
  else riskRewardScore = 0;

  const baseTradeabilityScore = Math.round(
    (confidence * 0.30) +
    (opportunityScore * 0.25) +
    (bqWeight * 0.20) +
    (pqWeight * 0.15) +
    (riskRewardScore * 0.10)
  );

  let regimeAdjustment = 0;
  if (direction === 'UP') {
    if (regime === 'STRONG_BULL') regimeAdjustment = 10;
    else if (regime === 'BULL') regimeAdjustment = 5;
    else if (regime === 'BEAR') regimeAdjustment = -10;
    else if (regime === 'STRONG_BEAR') regimeAdjustment = -20;
  } else if (direction === 'DOWN') {
    if (regime === 'STRONG_BEAR') regimeAdjustment = 10;
    else if (regime === 'BEAR') regimeAdjustment = 5;
    else if (regime === 'BULL') regimeAdjustment = -10;
    else if (regime === 'STRONG_BULL') regimeAdjustment = -20;
  }

  let mtfAdjustment = 0;
  if (direction === 'UP' || direction === 'DOWN') {
    if (multiTimeframeScore >= 90) mtfAdjustment = 10;
    else if (multiTimeframeScore >= 75) mtfAdjustment = 5;
    else if (multiTimeframeScore < 50) mtfAdjustment = -10;
  }

  let sectorAdjustment = 0;
  if (sectorClassification) {
    if (direction === 'UP') {
      if (sectorClassification === 'VERY_STRONG') sectorAdjustment = 10;
      else if (sectorClassification === 'STRONG') sectorAdjustment = 5;
      else if (sectorClassification === 'WEAK') sectorAdjustment = -10;
      else if (sectorClassification === 'VERY_WEAK') sectorAdjustment = -20;
    } else if (direction === 'DOWN') {
      if (sectorClassification === 'VERY_WEAK') sectorAdjustment = 10;
      else if (sectorClassification === 'WEAK') sectorAdjustment = 5;
      else if (sectorClassification === 'STRONG') sectorAdjustment = -10;
      else if (sectorClassification === 'VERY_STRONG') sectorAdjustment = -20;
    }
  }

  let rsAdjustment = 0;
  if (rsClassification) {
    if (direction === 'UP') {
      if (rsClassification === 'LEADER') rsAdjustment = 10;
      else if (rsClassification === 'STRONG') rsAdjustment = 5;
      else if (rsClassification === 'WEAK') rsAdjustment = -10;
      else if (rsClassification === 'LAGGARD') rsAdjustment = -20;
    } else if (direction === 'DOWN') {
      if (rsClassification === 'LAGGARD') rsAdjustment = 10;
      else if (rsClassification === 'WEAK') rsAdjustment = 5;
      else if (rsClassification === 'STRONG') rsAdjustment = -10;
      else if (rsClassification === 'LEADER') rsAdjustment = -20;
    }
  }

  let volumeAdjustment = 0;
  if (volumeClassification) {
    if (direction === 'UP') {
      if (volumeClassification === 'INSTITUTIONAL_ACCUMULATION') volumeAdjustment = 15;
      else if (volumeClassification === 'STRONG_BUYING') volumeAdjustment = 10;
      else if (volumeClassification === 'HEALTHY_VOLUME') volumeAdjustment = 5;
      else if (volumeClassification === 'WEAK_VOLUME') volumeAdjustment = -10;
      else if (volumeClassification === 'INSTITUTIONAL_DISTRIBUTION') volumeAdjustment = -25;
    } else if (direction === 'DOWN') {
      if (volumeClassification === 'INSTITUTIONAL_DISTRIBUTION') volumeAdjustment = 25;
      else if (volumeClassification === 'WEAK_VOLUME') volumeAdjustment = 10;
      else if (volumeClassification === 'HEALTHY_VOLUME') volumeAdjustment = -5;
      else if (volumeClassification === 'STRONG_BUYING') volumeAdjustment = -15;
      else if (volumeClassification === 'INSTITUTIONAL_ACCUMULATION') volumeAdjustment = -25;
    }
  }

  const tradeabilityScore = Math.max(0, Math.min(100, baseTradeabilityScore + regimeAdjustment + mtfAdjustment + sectorAdjustment + rsAdjustment + volumeAdjustment));

  const rejectionReasons = new Set<string>(extraReasons);
  if (confidence < 75) rejectionReasons.add("Confidence below 75");
  if (opportunityScore < 75) rejectionReasons.add("Opportunity score below 75");
  if (riskReward < 1.8) rejectionReasons.add("Risk/Reward below 1.8");
  if (!hasValidTradePlan) rejectionReasons.add("Invalid trade structure");
  if (!allowedPatterns.includes(pattern)) rejectionReasons.add("Pattern not in approved list");
  if (!allowedBreakouts.includes(breakoutStatus)) rejectionReasons.add("Breakout status rejected");

  const meetsHardCriteria = rejectionReasons.size === 0;

  let tradeType = "REJECTED";
  if (tradeabilityScore >= 85 && confidence >= 80 && opportunityScore >= 80 && riskReward >= 2 && multiTimeframeScore >= 75) tradeType = "HIGH_CONVICTION";
  else if (tradeabilityScore >= 70) tradeType = "TRADEABLE";
  else if (tradeabilityScore >= 55) tradeType = "WATCHLIST";
  else tradeType = "REJECTED";

  if (!meetsHardCriteria && (tradeType === "HIGH_CONVICTION" || tradeType === "TRADEABLE")) {
      tradeType = "WATCHLIST";
  }
  
  let mtfUpgraded = false;
  let mtfDowngraded = false;
  
  if (tradeType === "TRADEABLE" && multiTimeframeScore < 50) {
      tradeType = "WATCHLIST";
      rejectionReasons.add("Waiting for timeframe alignment");
      mtfDowngraded = true;
  }

  const tradeable = tradeType === "HIGH_CONVICTION" || tradeType === "TRADEABLE";

  let baseTradeType = "REJECTED";
  if (baseTradeabilityScore >= 85) baseTradeType = "HIGH_CONVICTION";
  else if (baseTradeabilityScore >= 70) baseTradeType = "TRADEABLE";
  else if (baseTradeabilityScore >= 55) baseTradeType = "WATCHLIST";

  if (!meetsHardCriteria && (baseTradeType === "HIGH_CONVICTION" || baseTradeType === "TRADEABLE")) {
      baseTradeType = "WATCHLIST";
  }
  
  if (baseTradeType !== tradeType && (tradeType === 'HIGH_CONVICTION' || tradeType === 'TRADEABLE')) {
    if (baseTradeType === 'WATCHLIST' || baseTradeType === 'REJECTED') {
       mtfUpgraded = true;
    }
  }

  return {
    tradeable,
    tradeType,
    tradeabilityScore,
    rejectionReasons: Array.from(rejectionReasons),
    regimeAdjustment,
    mtfAdjustment,
    sectorAdjustment,
    rsAdjustment,
    volumeAdjustment,
    mtfUpgraded,
    mtfDowngraded,
    classChanged: baseTradeType !== tradeType
  };
}

function buildScannerSignal({
  ticker,
  predictionDirection,
  pattern,
  breakoutStatus,
  confidence
}: {
  ticker: string;
  predictionDirection: string | undefined;
  pattern: string;
  breakoutStatus: string;
  confidence: number;
}) {
  const isBullishPattern = 
    ['Volume Breakout', 'Uptrend Breakout', 'Range Breakout', 'Pullback Near Support', 'Ascending Triangle', 'Bull Flag', 'Double Bottom', 'Cup and Handle', 'Support Bounce', 'Moving Average Pullback', 'Volatility Squeeze Breakout'].includes(pattern) && 
    ['NEAR_BREAKOUT', 'BREAKOUT_CONFIRMED'].includes(breakoutStatus);


  if (isBullishPattern) {
    if (predictionDirection === 'UP') {
      return {
        finalDirection: "UP",
        signalBias: "BULLISH",
        consistency: "CONFIRMED",
        reason: "Prediction direction confirms bullish pattern"
      };
    } else if (predictionDirection === 'NEUTRAL' || !predictionDirection) {
      return {
        finalDirection: "UP",
        signalBias: "BULLISH",
        consistency: "WEAK",
        reason: "Bullish pattern active but prediction direction is neutral"
      };
    } else if (predictionDirection === 'DOWN') {
      return {
        finalDirection: "NEUTRAL",
        signalBias: "NEUTRAL",
        consistency: "CONFLICT",
        reason: "Bullish pattern conflicts with bearish prediction"
      };
    }
  }

  // If no active bullish/bearish pattern exists:
  if (predictionDirection === 'UP' || predictionDirection === 'DOWN') {
    return {
      finalDirection: predictionDirection,
      signalBias: predictionDirection === 'UP' ? 'BULLISH' : 'BEARISH',
      consistency: "WEAK",
      reason: "No active scanner pattern confirmation"
    };
  }

  return {
    finalDirection: "NEUTRAL",
    signalBias: "NEUTRAL",
    consistency: "WEAK",
    reason: "No active scanner pattern confirmation"
  };
}

function calculateScannerConfidence({
  price,
  sma20,
  sma50,
  rsi,
  volume,
  avgVolume,
  atr,
  pattern,
  breakoutStatus,
  scannerDirection,
}: {
  price: number;
  sma20: number;
  sma50: number;
  rsi: number;
  volume: number;
  avgVolume: number;
  atr: number;
  pattern: string;
  breakoutStatus: string;
  scannerDirection: string;
}) {
  let trendScore = 50; 
  if (scannerDirection === 'UP') {
    if (price > sma20 && sma20 > sma50) trendScore = 100;
    else if (price > sma20) trendScore = 75;
    else if (price > sma50) trendScore = 60;
    else trendScore = 30;
  } else if (scannerDirection === 'DOWN') {
    if (price < sma20 && sma20 < sma50) trendScore = 100;
    else if (price < sma20) trendScore = 75;
    else if (price < sma50) trendScore = 60;
    else trendScore = 30;
  }
  
  if (scannerDirection === 'UP' && rsi > 50) trendScore += (rsi - 50);
  if (scannerDirection === 'DOWN' && rsi < 50) trendScore += (50 - rsi);
  trendScore = Math.min(100, Math.max(0, trendScore));

  let volumeScore = 50;
  if (avgVolume > 0) {
    const volRatio = volume / avgVolume;
    if (volRatio >= 2.0) volumeScore = 100;
    else if (volRatio >= 1.5) volumeScore = 80;
    else if (volRatio >= 1.0) volumeScore = 60;
    else volumeScore = 40 * volRatio;
  }

  let patternScore = 50;
  if (pattern !== "No Clear Pattern") {
    if (breakoutStatus === "BREAKOUT_CONFIRMED") patternScore = 100;
    else if (breakoutStatus === "NEAR_BREAKOUT") patternScore = 80;
    else patternScore = 60;
  } else {
    patternScore = 30;
  }

  let mtfScore = 50;
  if (scannerDirection === 'UP') {
    mtfScore = price > sma50 ? 90 : 30;
  } else if (scannerDirection === 'DOWN') {
    mtfScore = price < sma50 ? 90 : 30;
  }

  const atrPct = (atr / price) * 100;
  let volatilityScore = 50;
  if (atrPct >= 1.0 && atrPct <= 3.0) volatilityScore = 90;
  else if (atrPct > 3.0 && atrPct <= 5.0) volatilityScore = 70;
  else if (atrPct > 5.0) volatilityScore = 30;
  else volatilityScore = 60;

  const historyScore = 50; // Neutral fallback

  let finalConfidence = (
    trendScore * 0.25 +
    volumeScore * 0.20 +
    patternScore * 0.20 +
    mtfScore * 0.15 +
    volatilityScore * 0.10 +
    historyScore * 0.10
  );

  finalConfidence = Math.max(5, Math.min(95, Math.round(finalConfidence)));

  return {
    trendScore: Math.round(trendScore),
    volumeScore: Math.round(volumeScore),
    patternScore: Math.round(patternScore),
    mtfScore: Math.round(mtfScore),
    volatilityScore: Math.round(volatilityScore),
    historyScore: Math.round(historyScore),
    finalConfidence
  };
}

export async function GET(request?: NextRequest) {
  const t0 = performance.now();
  
  const searchParams = request?.nextUrl?.searchParams || new URL('http://localhost').searchParams;
  const rawLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 30) : 30;
  
  const cacheKey = `scanner:limit:${limit}`;
  
  // Scanner Results Cache (30s)
  if (scannerCache[cacheKey] && Date.now() - scannerCache[cacheKey].timestamp < 30000) {
    return NextResponse.json(scannerCache[cacheKey].data);
  }

  const [usRegimeData, indiaRegimeData] = await Promise.all([
    detectMarketRegime('US'),
    detectMarketRegime('INDIA')
  ]);

  try {
    let fetchTotal = 0;
    let patternTotal = 0;
    let confidenceTotal = 0;
    let srTotal = 0;
    let cachedCount = 0;
    let boosted = 0;
    let penalized = 0;
    let scoreChangeSum = 0;
    let classificationsChanged = 0;
    
    // MTF Metrics
    let mtfScoreSum = 0;
    let mtfDailyBullish = 0;
    let mtfWeeklyBullish = 0;
    let mtfMonthlyBullish = 0;
    let mtfUpgradedCount = 0;
    let mtfDowngradedCount = 0;
    let highConvictionAfterMTF = 0;
    let mtfScoreArray: number[] = [];

    // --- SECTOR ROTATION INIT ---
    let sectorScoreSum = 0;
    let sectorCount = 0;
    let sectorBoosted = 0;
    let sectorPenalized = 0;
    const sectorCache = new Map<string, SectorStrength>();

    // --- RELATIVE STRENGTH INIT ---
    let rsScoreSum = 0;
    let rsBoosted = 0;
    let rsPenalized = 0;
    let rsCount = 0;

    // --- INSTITUTIONAL VOLUME INIT ---
    let volRvolSum = 0;
    let volHighestRvol = 0;
    let volLowestRvol = 9999;
    let volInstBuyingCount = 0;
    let volDistCount = 0;
    let volBoosted = 0;
    let volPenalized = 0;
    let volHighestRvolTicker = '';
    let volLowestRvolTicker = '';
    let volCount = 0;

    const tickersToScan = SCANNER_UNIVERSE_30.slice(0, limit);
    const uniqueSectors = Array.from(new Set(tickersToScan.map(t => JSON.stringify(getSectorForStock(t)))));
    
    // Fetch market data
    const [usMarketData, indiaMarketData] = await Promise.all([
      getStockDataInternal('SPY').catch(() => null),
      getStockDataInternal('^NSEI').catch(() => null)
    ]);

    // Pre-fetch all sector indices
    await Promise.all(uniqueSectors.map(async (secStr) => {
      const { sector, region } = JSON.parse(secStr);
      const indexTicker = getIndexForSector(sector, region);
      const marketData = region === 'US' ? usMarketData : indiaMarketData;
      let history = null;
      if (indexTicker) {
         const d = await getStockDataInternal(indexTicker).catch(() => null);
         if (d) history = d.history;
      }
      const strength = calculateSectorStrength(sector, region, history || [], marketData?.history || null);
      sectorCache.set(secStr, strength);
      
      sectorScoreSum += strength.score;
      sectorCount++;
    }));

    const sortedSectors = Array.from(sectorCache.values()).sort((a, b) => b.score - a.score);
    const topSector = sortedSectors.length > 0 ? sortedSectors[0] : null;
    const weakestSector = sortedSectors.length > 0 ? sortedSectors[sortedSectors.length - 1] : null;

    const results: PromiseSettledResult<any>[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < tickersToScan.length; i += BATCH_SIZE) {
      const batch = tickersToScan.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (ticker) => {
          const pFetch0 = performance.now();
          const data = await getStockDataInternal(ticker);
          fetchTotal += performance.now() - pFetch0;
          
          if (!data || !data.quote) {
            throw new Error(`No data for ${ticker}`);
          }
        
        if (data.source === 'cached') cachedCount++;

        const mtf = calculateMultiTimeframeConfirmation(data.history);
        const prediction = generatePrediction(
          ticker,
          data.quote.price,
          data.quote.volume,
          data.history,
          data.indicators
        );

        const price = data.quote.price;
        const sma20 = data.indicators.sma20;
        const sma50 = data.indicators.sma50;
        const rsi = data.indicators.rsi14;
        const macd = data.indicators.macd?.macd;
        const atr = data.indicators.atr14 || (price * 0.02); // Fallback ATR

        const pPat0 = performance.now();
        const detected = detectMarketPattern(data.history, data.indicators, price, data.quote.volume);
        patternTotal += performance.now() - pPat0;
        
        const pattern = detected.pattern;
        let breakoutStatus = "WATCHING";

        if (pattern !== "No Clear Pattern") {
          if (price > data.indicators.bollingerUpper) {
            breakoutStatus = "BREAKOUT_CONFIRMED";
          } else if (price > sma20 && price < data.indicators.bollingerUpper) {
            breakoutStatus = "NEAR_BREAKOUT";
          }
        } else {
          if (rsi < 40 && macd && macd < 0) {
            breakoutStatus = "FAILED_BREAKOUT";
          }
        }

        const scannerSignal = buildScannerSignal({
          ticker,
          predictionDirection: prediction.direction,
          pattern,
          breakoutStatus,
          confidence: prediction.confidence
        });
        
        const resolvedDirection = scannerSignal.finalDirection;

        const pConf0 = performance.now();
        const confScores = calculateScannerConfidence({
          price,
          sma20,
          sma50,
          rsi,
          volume: data.quote.volume,
          avgVolume: data.indicators.avgVolume20 || 0,
          atr,
          pattern,
          breakoutStatus,
          scannerDirection: resolvedDirection
        });
        confidenceTotal += performance.now() - pConf0;

        // Calculate trade levels
        const pSR0 = performance.now();
        const srLevels = calculateSupportResistanceLevels(data.history, price, resolvedDirection === 'UP');
        srTotal += performance.now() - pSR0;
        
        let usedFallbackATR = false;

        let entry = price;
        let stopLoss = 0;
        let target = 0;
        let risk = 0;
        let riskReward = 0;
        const extraReasons: string[] = [];
        
        let tradePlanSource = "invalid";
        let tradePlanQuality = "INVALID";
        
        let riskPercent = 0;
        let rewardPercent = 0;
        let riskATR = 0;
        let validationPassed = false;
        let validationReasons: string[] = [];

        if (resolvedDirection === 'UP' || resolvedDirection === 'DOWN') {
          // SR Plan
          if (breakoutStatus === 'NEAR_BREAKOUT' && srLevels.breakoutLevel !== null) {
            entry = srLevels.breakoutLevel;
          } else {
            entry = price;
          }

          if (resolvedDirection === 'UP') {
            stopLoss = srLevels.nearestSupport !== null && srLevels.nearestSupport < entry ? srLevels.nearestSupport : entry - 1.5 * atr;
            target = srLevels.nearestResistance !== null && srLevels.nearestResistance > entry ? srLevels.nearestResistance : entry + 2 * Math.abs(entry - stopLoss);
          } else {
            stopLoss = srLevels.nearestResistance !== null && srLevels.nearestResistance > entry ? srLevels.nearestResistance : entry + 1.5 * atr;
            target = srLevels.nearestSupport !== null && srLevels.nearestSupport < entry ? srLevels.nearestSupport : entry - 2 * Math.abs(stopLoss - entry);
          }
          
          risk = Math.abs(entry - stopLoss);
          riskReward = risk > 0 ? Math.abs(target - entry) / risk : 0;
          
          const srValidation = validateTradePlan({ direction: resolvedDirection, entry, stopLoss, target, riskReward, atr });
          
          if (srValidation.valid) {
             usedFallbackATR = false;
             tradePlanSource = "support_resistance";
             tradePlanQuality = riskReward >= 2 ? "HIGH" : "LOW";
             validationPassed = true;
             validationReasons = srValidation.reasons;
          } else {
             usedFallbackATR = true;
             
             if (breakoutStatus === 'NEAR_BREAKOUT' && srLevels.breakoutLevel !== null) {
               entry = srLevels.breakoutLevel;
             } else {
               entry = price;
             }

             if (resolvedDirection === 'UP') {
               stopLoss = entry - 1.5 * atr;
               risk = entry - stopLoss;
               target = entry + 2 * risk;
             } else {
               stopLoss = entry + 1.5 * atr;
               risk = stopLoss - entry;
               target = entry - 2 * risk;
             }
             
             risk = Math.abs(entry - stopLoss);
             riskReward = risk > 0 ? Math.abs(target - entry) / risk : 0;
             
             const atrValidation = validateTradePlan({ direction: resolvedDirection, entry, stopLoss, target, riskReward, atr });
             if (atrValidation.valid) {
                tradePlanSource = "atr_fallback";
                tradePlanQuality = riskReward >= 2 ? "MEDIUM" : "LOW";
                validationPassed = true;
                validationReasons = atrValidation.reasons;
             } else {
                tradePlanSource = "invalid";
                tradePlanQuality = "INVALID";
                validationPassed = false;
                validationReasons = atrValidation.reasons;
                extraReasons.push(...atrValidation.reasons);
             }
          }
          
          riskPercent = Math.abs(entry - stopLoss) / entry * 100;
          rewardPercent = Math.abs(target - entry) / entry * 100;
          riskATR = Math.abs(entry - stopLoss) / atr;
        } else {
          // NEUTRAL
          stopLoss = entry;
          target = entry;
          riskReward = 0;
          extraReasons.push("Neutral direction");
        }
        
        let hasValidTradePlan = validationPassed && extraReasons.length === 0;

        if (breakoutStatus === "FAILED_BREAKOUT") {
          extraReasons.push("Failed breakout");
        }

        const isIndia = ticker.endsWith('.NS') || ticker.endsWith('.BO') || ticker.endsWith('.BSE') || ticker.endsWith('.NSE');
        const currentRegimeData = isIndia ? indiaRegimeData : usRegimeData;

        const { sector, region } = getSectorForStock(ticker);
        const sectorStrength = sectorCache.get(JSON.stringify({ sector, region }));

        const marketHistoryForRS = isIndia ? indiaMarketData?.history || null : usMarketData?.history || null;
        const rsResult = calculateRelativeStrength(data.history, marketHistoryForRS);
        const volumeResult = calculateVolumeIntelligence(data.history);

        const tradeability = evaluateTradeabilityV2({
          confidence: confScores.finalConfidence,
          opportunityScore: 0, // Placeholder
          riskReward,
          hasValidTradePlan,
          pattern,
          breakoutStatus,
          regime: currentRegimeData.regime,
          direction: resolvedDirection,
          multiTimeframeScore: mtf.multiTimeframeScore,
          sectorClassification: sectorStrength?.classification,
          rsClassification: rsResult.classification,
          volumeClassification: volumeResult.classification,
          extraReasons
        });

        if (tradeability.regimeAdjustment > 0) boosted++;
        if (tradeability.regimeAdjustment < 0) penalized++;
        if (tradeability.sectorAdjustment > 0) sectorBoosted++;
        if (tradeability.sectorAdjustment < 0) sectorPenalized++;
        if (tradeability.rsAdjustment > 0) rsBoosted++;
        if (tradeability.rsAdjustment < 0) rsPenalized++;
        if (tradeability.volumeAdjustment > 0) volBoosted++;
        if (tradeability.volumeAdjustment < 0) volPenalized++;
        scoreChangeSum += (tradeability.regimeAdjustment + tradeability.mtfAdjustment + tradeability.sectorAdjustment + tradeability.rsAdjustment + tradeability.volumeAdjustment);
        if (tradeability.classChanged) classificationsChanged++;
        
        rsScoreSum += rsResult.score;
        rsCount++;
        
        volRvolSum += volumeResult.rvol;
        if (volumeResult.rvol > volHighestRvol) {
          volHighestRvol = volumeResult.rvol;
          volHighestRvolTicker = ticker;
        }
        if (volumeResult.rvol < volLowestRvol) {
          volLowestRvol = volumeResult.rvol;
          volLowestRvolTicker = ticker;
        }
        if (volumeResult.classification === 'INSTITUTIONAL_ACCUMULATION' || volumeResult.classification === 'STRONG_BUYING') volInstBuyingCount++;
        if (volumeResult.classification === 'INSTITUTIONAL_DISTRIBUTION') volDistCount++;
        volCount++;
        
        mtfScoreSum += mtf.multiTimeframeScore;
        if (mtf.dailyTrend === 'BULLISH') mtfDailyBullish++;
        if (mtf.weeklyTrend === 'BULLISH') mtfWeeklyBullish++;
        if (mtf.monthlyTrend === 'BULLISH') mtfMonthlyBullish++;
        if (tradeability.mtfUpgraded) mtfUpgradedCount++;
        if (tradeability.mtfDowngraded) mtfDowngradedCount++;
        if (tradeability.tradeType === 'HIGH_CONVICTION') highConvictionAfterMTF++;
        mtfScoreArray.push(mtf.multiTimeframeScore);

        const opportunityData = calculateOpportunityScore({
          pattern,
          patternStrength: detected.patternStrength,
          patternConfidence: detected.patternConfidence,
          breakoutStatus,
          confidence: confScores.finalConfidence,
          riskReward,
          tradeStatus: tradeability.tradeable ? 'TRADEABLE' : 'REJECTED',
          finalDirection: resolvedDirection,
          consistency: scannerSignal.consistency,
          hasValidTradePlan
        });

        return {
          ticker,
          pattern,
          breakoutStatus,
          entry: hasValidTradePlan ? Number(entry.toFixed(2)) : null,
          stopLoss: hasValidTradePlan ? Number(stopLoss.toFixed(2)) : null,
          target: hasValidTradePlan ? Number(target.toFixed(2)) : null,
          riskReward: hasValidTradePlan ? Number(riskReward.toFixed(2)) : null,
          hasValidTradePlan,
          confidence: confScores.finalConfidence,
          direction: resolvedDirection,
          signalBias: scannerSignal.signalBias,
          consistency: scannerSignal.consistency,
          tradeable: tradeability.tradeable,
          tradeType: tradeability.tradeType,
          tradeabilityScore: tradeability.tradeabilityScore,
          tradeStatus: tradeability.tradeable ? 'TRADEABLE' : 'REJECTED',
          rejectionReasons: tradeability.rejectionReasons,
          price: data.quote.price,
          source: data.source,
          opportunityScore: opportunityData.opportunityScore,
          support: srLevels.nearestSupport,
          resistance: srLevels.nearestResistance,
          breakoutLevel: srLevels.breakoutLevel,
          tradePlanSource,
          tradePlanQuality,
          multiTimeframeScore: mtf.multiTimeframeScore,
          dailyTrend: mtf.dailyTrend,
          weeklyTrend: mtf.weeklyTrend,
          monthlyTrend: mtf.monthlyTrend,
          sector: sectorStrength?.sector,
          sectorScore: sectorStrength?.score,
          sectorClassification: sectorStrength?.classification,
          rsScore: rsResult.score,
          rsClassification: rsResult.classification,
          rs20: rsResult.rs20,
          rs50: rsResult.rs50,
          rs100: rsResult.rs100,
          volCurrent: volumeResult.currentVolume,
          volAvg20D: volumeResult.avgVolume20D,
          volRvol: volumeResult.rvol,
          volClassification: volumeResult.classification
        };
      })
      );
      results.push(...batchResults);
    }
    
    let validTradePlans = 0;
    let successfulTickers = 0;

    const fulfilledResults = results.flatMap(r => {
      if (r.status === 'fulfilled') {
        successfulTickers++;
        if (r.value.hasValidTradePlan) validTradePlans++;
        return [r.value];
      }
      return [];
    });

    const tradeTypeOrder: Record<string, number> = {
      "HIGH_CONVICTION": 1,
      "TRADEABLE": 2,
      "WATCHLIST": 3,
      "REJECTED": 4
    };

    const scannerResults = fulfilledResults.sort((a, b) => {
      const typeDiff = tradeTypeOrder[a.tradeType] - tradeTypeOrder[b.tradeType];
      if (typeDiff !== 0) return typeDiff;
      
      const volDiff = (b.volRvol || 0) - (a.volRvol || 0);
      if (volDiff !== 0) return volDiff;
      
      const rsDiff = (b.rsScore || 0) - (a.rsScore || 0);
      if (rsDiff !== 0) return rsDiff;
      
      const oppDiff = b.opportunityScore - a.opportunityScore;
      if (oppDiff !== 0) return oppDiff;
      
      const confDiff = b.confidence - a.confidence;
      if (confDiff !== 0) return confDiff;
      
      return (b.riskReward || 0) - (a.riskReward || 0);
    });

    const topLeaders = [...scannerResults]
      .sort((a, b) => (b.rsScore || 0) - (a.rsScore || 0))
      .map(r => ({
        ticker: r.ticker,
        classification: r.rsClassification,
        rsScore: r.rsScore,
        rs20: r.rs20
      })).slice(0, 5);
      
    const worstLaggard = [...scannerResults]
      .sort((a, b) => (a.rsScore || 0) - (b.rsScore || 0))[0];

    const t1 = performance.now();
    const generationTime = t1 - t0;
    
    const scannerHealthScore = 80;

    const payload = {
      results: scannerResults,
      metrics: {
        totalUniverse: SCANNER_UNIVERSE_30.length,
        requestedLimit: limit,
        successfulFetches: successfulTickers,
        failedFetches: limit - successfulTickers,
        cacheHits: cachedCount,
        generationTime,
        tradeableCount: scannerResults.filter(r => r.tradeable).length,
        rejectedCount: scannerResults.filter(r => !r.tradeable).length,
        activeBreakoutCount: scannerResults.filter(r => r.breakoutStatus === 'BREAKOUT_CONFIRMED' || r.breakoutStatus === 'NEAR_BREAKOUT').length,
        averageConfidence: scannerResults.length > 0 ? scannerResults.reduce((acc, r) => acc + r.confidence, 0) / scannerResults.length : 0,
        averageOpportunityScore: scannerResults.length > 0 ? scannerResults.reduce((acc, r) => acc + r.opportunityScore, 0) / scannerResults.length : 0,
        patternDetectionTime: patternTotal,
        confidenceTime: confidenceTotal,
        supportResistanceTime: srTotal,
        cachedCount,
        scannerHealthScore,
        usRegime: usRegimeData,
        indiaRegime: indiaRegimeData,
        regimeBoosted: boosted,
        regimePenalized: penalized,
        regimeClassChanged: classificationsChanged,
        regimeAvgScoreChange: successfulTickers > 0 ? Number((scoreChangeSum / successfulTickers).toFixed(2)) : 0,
        mtfAverageScore: successfulTickers > 0 ? Number((mtfScoreSum / successfulTickers).toFixed(2)) : 0,
        mtfDailyBullish,
        mtfWeeklyBullish,
        mtfMonthlyBullish,
        mtfUpgrades: mtfUpgradedCount,
        mtfDowngrades: mtfDowngradedCount,
        mtfHighConvictionCount: highConvictionAfterMTF,
        mtfTop5Scores: [...mtfScoreArray].sort((a, b) => b - a).slice(0, 5),
        mtfLowestScore: mtfScoreArray.length > 0 ? Math.min(...mtfScoreArray) : 0,
        sectorMetrics: {
          topSector,
          weakestSector,
          avgSectorScore: sectorCount > 0 ? Number((sectorScoreSum / sectorCount).toFixed(2)) : 0,
          boostedTrades: sectorBoosted,
          penalizedTrades: sectorPenalized,
          sectorClassChanges: classificationsChanged // Approximated reusing the combined changes counter
        },
        topSectors: Array.from(sectorCache.values()).sort((a, b) => b.score - a.score).slice(0, 5),
        rsMetrics: {
          averageRS: rsCount > 0 ? Number((rsScoreSum / rsCount).toFixed(2)) : 0,
          topLeader: topLeaders.length > 0 ? topLeaders[0] : null,
          worstLaggard: worstLaggard ? { ticker: worstLaggard.ticker, rsScore: worstLaggard.rsScore, classification: worstLaggard.rsClassification } : null,
          boostedTrades: rsBoosted,
          penalizedTrades: rsPenalized,
          classificationChanges: classificationsChanged // Approximated reusing the combined changes counter
        },
        topLeaders,
        institutionalFlow: {
          buying: scannerResults.filter(r => r.volClassification === 'INSTITUTIONAL_ACCUMULATION' || r.volClassification === 'STRONG_BUYING').map(r => r.ticker).slice(0, 5),
          distribution: scannerResults.filter(r => r.volClassification === 'INSTITUTIONAL_DISTRIBUTION').map(r => r.ticker).slice(0, 5)
        },
        volumeMetrics: {
          avgRVOL: volCount > 0 ? Number((volRvolSum / volCount).toFixed(2)) : 0,
          highestRVOL: { ticker: volHighestRvolTicker, rvol: volHighestRvol },
          lowestRVOL: { ticker: volLowestRvolTicker, rvol: volLowestRvol },
          institutionalBuyingCount: volInstBuyingCount,
          distributionCount: volDistCount,
          boostedTrades: volBoosted,
          penalizedTrades: volPenalized
        }
      }
    };
    
    console.log(`\n================= SCANNER REPORT =================`);
    console.log(`1. Number of sectors: ${sectorCount}`);
    console.log(`2. Strongest sector: ${topSector?.sector} (${topSector?.score})`);
    console.log(`3. Weakest sector: ${weakestSector?.sector} (${weakestSector?.score})`);
    console.log(`4. Boosted trades: ${sectorBoosted}`);
    console.log(`5. Penalized trades: ${sectorPenalized}`);
    console.log(`====================================================\n`);
    
    console.log(`\n================= RELATIVE STRENGTH REPORT =================`);
    console.log(`1. Strongest stock: ${payload.metrics.rsMetrics.topLeader?.ticker || 'None'} (${payload.metrics.rsMetrics.topLeader?.rsScore || 0})`);
    console.log(`2. Weakest stock: ${payload.metrics.rsMetrics.worstLaggard?.ticker || 'None'} (${payload.metrics.rsMetrics.worstLaggard?.rsScore || 0})`);
    console.log(`3. Average RS score: ${payload.metrics.rsMetrics.averageRS}`);
    console.log(`4. Number boosted: ${rsBoosted}`);
    console.log(`5. Number penalized: ${rsPenalized}`);
    console.log(`6. Classification changes: ${classificationsChanged}`);
    console.log(`====================================================\n`);

    console.log(`\n================= INSTITUTIONAL VOLUME REPORT =================`);
    console.log(`1. Highest RVOL stock: ${payload.metrics.volumeMetrics.highestRVOL.ticker} (${payload.metrics.volumeMetrics.highestRVOL.rvol})`);
    console.log(`2. Lowest RVOL stock: ${payload.metrics.volumeMetrics.lowestRVOL.ticker} (${payload.metrics.volumeMetrics.lowestRVOL.rvol})`);
    console.log(`3. Institutional buying count: ${payload.metrics.volumeMetrics.institutionalBuyingCount}`);
    console.log(`4. Distribution count: ${payload.metrics.volumeMetrics.distributionCount}`);
    console.log(`5. Boosted trades: ${payload.metrics.volumeMetrics.boostedTrades}`);
    console.log(`6. Penalized trades: ${payload.metrics.volumeMetrics.penalizedTrades}`);
    console.log(`====================================================\n`);

    scannerCache[cacheKey] = {
      data: payload,
      timestamp: Date.now()
    };

    return NextResponse.json(payload);

  } catch (error: unknown) {
    console.error('Scanner API Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
