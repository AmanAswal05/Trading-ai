/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AuditReport {
  timestamp: string;
  totalVerified: number;
  tradeableVerified: number;
  overallAccuracy: number;
  tradeableAccuracy: number;
  averageConfidenceCorrect: number;
  averageConfidenceIncorrect: number;
  calibrationError: number;
  mockExclusionCount: number;
  badges: {
    dataIntegrity: 'PASS' | 'FAIL' | 'WARNING';
    noLeakage: 'PASS' | 'FAIL' | 'WARNING';
    calibrationHealth: 'PASS' | 'FAIL' | 'WARNING';
    sampleSizeHealth: 'PASS' | 'FAIL' | 'WARNING';
    overfittingRisk: 'PASS' | 'FAIL' | 'WARNING';
  };
  failureReasons: string[];
}

let cachedReport: AuditReport | null = null;
let lastAuditTime = 0;

export function getAuditReportSync(): AuditReport | null {
  // Try to use cache if it's less than 1 hour old
  if (cachedReport && (Date.now() - lastAuditTime < 3600000)) {
    return cachedReport;
  }
  
  try {
    // If we need synchronous access and can't use await, we must rely on the caller or a warm cache.
    // However, PredictionsDbService.getAllPredictionsSync() exists from previous feature work.
    const { PredictionsDbService } = require('./predictions-db');
    const all = PredictionsDbService.getAllPredictionsSync();
    if (all && all.length > 0) {
      const verified = all.filter((p: any) => p.status === 'VERIFIED');
      cachedReport = runAccuracyAudit(verified);
      lastAuditTime = Date.now();
      return cachedReport;
    }
  } catch (e) {
    console.warn('[Audit] Failed to compute synchronous audit report:', e);
  }
  return null;
}

export function runAccuracyAudit(verifiedPredictions: any[]): AuditReport {
  const report: AuditReport = {
    timestamp: new Date().toISOString(),
    totalVerified: verifiedPredictions.length,
    tradeableVerified: 0,
    overallAccuracy: 0,
    tradeableAccuracy: 0,
    averageConfidenceCorrect: 0,
    averageConfidenceIncorrect: 0,
    calibrationError: 0,
    mockExclusionCount: 0,
    badges: {
      dataIntegrity: 'PASS',
      noLeakage: 'PASS',
      calibrationHealth: 'PASS',
      sampleSizeHealth: 'PASS',
      overfittingRisk: 'PASS',
    },
    failureReasons: [],
  };

  if (verifiedPredictions.length === 0) {
    report.badges.sampleSizeHealth = 'FAIL';
    report.failureReasons.push('No verified predictions found in the database.');
    return report;
  }

  let correctCount = 0;
  let tradeableCount = 0;
  let tradeableCorrectCount = 0;

  let sumConfCorrect = 0;
  let sumConfIncorrect = 0;
  let numIncorrect = 0;

  let highConfTotal = 0;
  let highConfCorrect = 0;

  const tickerCounts: Record<string, number> = {};
  let exactZeroErrorCount = 0;
  let leakageCount = 0;

  const validPredictions = [];

  for (const p of verifiedPredictions) {
    // Basic mock / identical check
    if (p.error_percentage === 0 || p.actual_price === 150.00) {
      exactZeroErrorCount++;
      report.mockExclusionCount++;
      continue; // Exclude from strict accuracy
    }

    // Leakage check: Prediction date should be strictly before verification date
    if (p.prediction_date && p.verification_date) {
      const pDate = new Date(p.prediction_date).getTime();
      const vDate = new Date(p.verification_date).getTime();
      if (pDate >= vDate) {
        leakageCount++;
        continue;
      }
    }

    validPredictions.push(p);

    const isCorrect = p.prediction_result === 'CORRECT';
    if (isCorrect) correctCount++;

    if (p.is_tradeable_signal) {
      tradeableCount++;
      if (isCorrect) tradeableCorrectCount++;
    }

    const conf = p.final_confidence || p.confidence_score || 0;
    if (isCorrect) {
      sumConfCorrect += conf;
    } else {
      sumConfIncorrect += conf;
      numIncorrect++;
    }

    if (conf >= 90) {
      highConfTotal++;
      if (isCorrect) highConfCorrect++;
    }

    tickerCounts[p.ticker] = (tickerCounts[p.ticker] || 0) + 1;
  }

  const validCount = validPredictions.length;
  if (validCount === 0) {
    report.badges.dataIntegrity = 'FAIL';
    report.failureReasons.push('All predictions were excluded as mock/fallback or leakage.');
    return report;
  }

  report.overallAccuracy = Number(((correctCount / validCount) * 100).toFixed(2));
  
  if (tradeableCount > 0) {
    report.tradeableVerified = tradeableCount;
    report.tradeableAccuracy = Number(((tradeableCorrectCount / tradeableCount) * 100).toFixed(2));
  }

  if (correctCount > 0) report.averageConfidenceCorrect = Number((sumConfCorrect / correctCount).toFixed(2));
  if (numIncorrect > 0) report.averageConfidenceIncorrect = Number((sumConfIncorrect / numIncorrect).toFixed(2));

  // Badge: Sample Size Health
  if (validCount >= 100) {
    report.badges.sampleSizeHealth = 'PASS';
  } else if (validCount >= 30) {
    report.badges.sampleSizeHealth = 'WARNING';
    report.failureReasons.push(`Low sample size (${validCount} valid predictions). Need 100+ for statistical significance.`);
  } else {
    report.badges.sampleSizeHealth = 'FAIL';
    report.failureReasons.push(`Critically low sample size (${validCount} valid predictions). Accuracy metrics are unreliable.`);
  }

  // Badge: Data Integrity
  if (report.mockExclusionCount > (verifiedPredictions.length * 0.2)) {
    report.badges.dataIntegrity = 'WARNING';
    report.failureReasons.push(`High mock data / perfect 0% error rate detected (${report.mockExclusionCount} excluded).`);
  }
  if (report.mockExclusionCount > (verifiedPredictions.length * 0.5)) {
    report.badges.dataIntegrity = 'FAIL';
  }

  // Badge: No Leakage
  if (leakageCount > 0) {
    report.badges.noLeakage = 'FAIL';
    report.failureReasons.push(`Future leakage detected: ${leakageCount} predictions have verification dates before or equal to prediction dates.`);
  }

  // Badge: Calibration Health
  if (numIncorrect > 0 && correctCount > 0) {
    if (report.averageConfidenceIncorrect > report.averageConfidenceCorrect) {
      report.badges.calibrationHealth = 'FAIL';
      report.failureReasons.push('Overconfidence detected: Average confidence of incorrect predictions is higher than correct ones.');
    } else if (report.averageConfidenceIncorrect > (report.averageConfidenceCorrect - 5)) {
      report.badges.calibrationHealth = 'WARNING';
      report.failureReasons.push('Poor separation: Model confidence does not significantly differ between correct and incorrect outcomes.');
    }
  }

  if (highConfTotal >= 10) {
    const highConfWinRate = (highConfCorrect / highConfTotal) * 100;
    report.calibrationError = Number(Math.abs(95 - highConfWinRate).toFixed(2));
    if (highConfWinRate < 70) {
      report.badges.calibrationHealth = 'FAIL';
      report.failureReasons.push(`Severe overconfidence: >90% confidence bucket only has a ${highConfWinRate.toFixed(1)}% win rate.`);
    } else if (highConfWinRate < 85) {
      if (report.badges.calibrationHealth !== 'FAIL') report.badges.calibrationHealth = 'WARNING';
      report.failureReasons.push(`Overconfidence: >90% confidence bucket has a ${highConfWinRate.toFixed(1)}% win rate.`);
    }
  }

  // Badge: Overfitting Risk
  let maxTickerCount = 0;
  let maxTicker = '';
  for (const [ticker, count] of Object.entries(tickerCounts)) {
    if (count > maxTickerCount) {
      maxTickerCount = count;
      maxTicker = ticker;
    }
  }
  
  if (validCount >= 20) {
    const dominantTickerRatio = maxTickerCount / validCount;
    if (dominantTickerRatio > 0.5) {
      report.badges.overfittingRisk = 'FAIL';
      report.failureReasons.push(`High overfitting risk: Ticker ${maxTicker} accounts for ${(dominantTickerRatio*100).toFixed(1)}% of all valid predictions.`);
    } else if (dominantTickerRatio > 0.3) {
      report.badges.overfittingRisk = 'WARNING';
      report.failureReasons.push(`Moderate overfitting risk: Dataset is heavily skewed towards ${maxTicker}.`);
    }
  }

  return report;
}
