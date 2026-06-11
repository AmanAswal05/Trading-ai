const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'lib', 'mock-predictions-db.json');

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found at:', dbPath);
  process.exit(1);
}

console.log('Loading database...');
const raw = fs.readFileSync(dbPath, 'utf8');
const predictions = JSON.parse(raw);
const verified = predictions.filter(p => p.status === 'VERIFIED');

console.log(`Total Predictions: ${predictions.length}`);
console.log(`Verified Predictions: ${verified.length}`);

if (verified.length === 0) {
  console.log('No verified predictions found to analyze.');
  process.exit(0);
}

// 1. Overall stats
const correct = verified.filter(p => p.prediction_result === 'CORRECT').length;
const partial = verified.filter(p => p.prediction_result === 'PARTIALLY_CORRECT').length;
const incorrect = verified.filter(p => p.prediction_result === 'INCORRECT').length;
const neutral = verified.filter(p => p.prediction_result === 'NEUTRAL').length;
const directional = verified.filter(p => p.predicted_direction !== 'NEUTRAL').length;

const accuracy = directional > 0 ? ((correct + partial * 0.5) / directional) * 100 : 0;
const winLossRatio = incorrect > 0 ? (correct / incorrect) : correct;

console.log('\n=== OVERALL PERFORMANCE ===');
console.log(`Accuracy: ${accuracy.toFixed(2)}%`);
console.log(`Win/Loss Ratio: ${winLossRatio.toFixed(2)}`);
console.log(`Correct: ${correct}`);
console.log(`Partial: ${partial}`);
console.log(`Incorrect: ${incorrect}`);
console.log(`Neutral: ${neutral}`);

// 2. By Ticker
const tickerStats = {};
verified.forEach(p => {
  if (!tickerStats[p.ticker]) {
    tickerStats[p.ticker] = { total: 0, correct: 0, partial: 0, incorrect: 0 };
  }
  const t = tickerStats[p.ticker];
  t.total++;
  if (p.prediction_result === 'CORRECT') t.correct++;
  else if (p.prediction_result === 'PARTIALLY_CORRECT') t.partial++;
  else if (p.prediction_result === 'INCORRECT') t.incorrect++;
});

console.log('\n=== ACCURACY BY TICKER ===');
const tickerList = Object.entries(tickerStats).map(([ticker, s]) => {
  const acc = s.total > 0 ? ((s.correct + s.partial * 0.5) / s.total) * 100 : 0;
  return { ticker, acc, ...s };
}).sort((a, b) => b.acc - a.acc);

console.log('Top performing tickers:');
tickerList.slice(0, 5).forEach(t => console.log(`  ${t.ticker}: ${t.acc.toFixed(1)}% (${t.total} predictions)`));
console.log('Worst performing tickers:');
tickerList.slice(-5).reverse().forEach(t => console.log(`  ${t.ticker}: ${t.acc.toFixed(1)}% (${t.total} predictions)`));

// 3. By Sector
const getSector = (ticker) => {
  const symbol = ticker.toUpperCase();
  if (symbol.startsWith('AAPL') || symbol.startsWith('MSFT')) return 'Technology';
  if (symbol.startsWith('GOOGL') || symbol.startsWith('META')) return 'Communication';
  if (symbol.startsWith('AMZN') || symbol.startsWith('TSLA')) return 'Consumer Cyclical';
  if (symbol.includes('RELIANCE') || symbol.includes('ONGC')) return 'Energy';
  if (symbol.includes('NIFTY') || symbol.includes('SENSEX') || symbol.includes('SPY')) return 'Index';
  return 'Financial Services';
};

const sectorStats = {};
verified.forEach(p => {
  const sec = getSector(p.ticker);
  if (!sectorStats[sec]) {
    sectorStats[sec] = { total: 0, correct: 0, partial: 0, incorrect: 0 };
  }
  const s = sectorStats[sec];
  s.total++;
  if (p.prediction_result === 'CORRECT') s.correct++;
  else if (p.prediction_result === 'PARTIALLY_CORRECT') s.partial++;
  else if (p.prediction_result === 'INCORRECT') s.incorrect++;
});

console.log('\n=== ACCURACY BY SECTOR ===');
Object.entries(sectorStats).map(([sector, s]) => {
  const acc = s.total > 0 ? ((s.correct + s.partial * 0.5) / s.total) * 100 : 0;
  return { sector, acc, ...s };
}).sort((a, b) => b.acc - a.acc).forEach(s => {
  console.log(`  ${s.sector}: ${s.acc.toFixed(1)}% (${s.total} predictions)`);
});

// 4. By Timeframe
const timeframeStats = {};
verified.forEach(p => {
  const tf = p.timeframe;
  if (!timeframeStats[tf]) {
    timeframeStats[tf] = { total: 0, correct: 0, partial: 0, incorrect: 0 };
  }
  const s = timeframeStats[tf];
  s.total++;
  if (p.prediction_result === 'CORRECT') s.correct++;
  else if (p.prediction_result === 'PARTIALLY_CORRECT') s.partial++;
  else if (p.prediction_result === 'INCORRECT') s.incorrect++;
});

console.log('\n=== ACCURACY BY TIMEFRAME ===');
Object.entries(timeframeStats).map(([tf, s]) => {
  const acc = s.total > 0 ? ((s.correct + s.partial * 0.5) / s.total) * 100 : 0;
  return { tf, acc, ...s };
}).sort((a, b) => b.acc - a.acc).forEach(s => {
  console.log(`  ${s.tf}: ${s.acc.toFixed(1)}% (${s.total} predictions)`);
});

// 5. Factors associated with success vs failure
let trendAvgCorrect = 0, trendAvgIncorrect = 0;
let rsiAvgCorrect = 0, rsiAvgIncorrect = 0;
let macdAvgCorrect = 0, macdAvgIncorrect = 0;
let volAvgCorrect = 0, volAvgIncorrect = 0;
let volumeAvgCorrect = 0, volumeAvgIncorrect = 0;
let correctCountWithExpl = 0;
let incorrectCountWithExpl = 0;

verified.forEach(p => {
  if (p.explanation) {
    const isCorrect = p.prediction_result === 'CORRECT';
    const isIncorrect = p.prediction_result === 'INCORRECT';
    
    if (isCorrect) {
      correctCountWithExpl++;
      trendAvgCorrect += p.explanation.trend_contribution || 0;
      rsiAvgCorrect += p.explanation.rsi_contribution || 0;
      macdAvgCorrect += p.explanation.macd_contribution || 0;
      volAvgCorrect += p.explanation.volatility_contribution || 0;
      volumeAvgCorrect += p.explanation.volume_contribution || 0;
    } else if (isIncorrect) {
      incorrectCountWithExpl++;
      trendAvgIncorrect += p.explanation.trend_contribution || 0;
      rsiAvgIncorrect += p.explanation.rsi_contribution || 0;
      macdAvgIncorrect += p.explanation.macd_contribution || 0;
      volAvgIncorrect += p.explanation.volatility_contribution || 0;
      volumeAvgIncorrect += p.explanation.volume_contribution || 0;
    }
  }
});

if (correctCountWithExpl > 0 && incorrectCountWithExpl > 0) {
  console.log('\n=== INDICATOR CONTRIBUTIONS BY OUTCOME ===');
  console.log(`Analyzed explanations: ${correctCountWithExpl} correct, ${incorrectCountWithExpl} incorrect`);
  console.log('Average contribution in CORRECT predictions:');
  console.log(`  Trend: ${(trendAvgCorrect / correctCountWithExpl).toFixed(1)}%`);
  console.log(`  RSI: ${(rsiAvgCorrect / correctCountWithExpl).toFixed(1)}%`);
  console.log(`  MACD: ${(macdAvgCorrect / correctCountWithExpl).toFixed(1)}%`);
  console.log(`  Volatility: ${(volAvgCorrect / correctCountWithExpl).toFixed(1)}%`);
  console.log(`  Volume: ${(volumeAvgCorrect / correctCountWithExpl).toFixed(1)}%`);

  console.log('Average contribution in INCORRECT predictions:');
  console.log(`  Trend: ${(trendAvgIncorrect / incorrectCountWithExpl).toFixed(1)}%`);
  console.log(`  RSI: ${(rsiAvgIncorrect / incorrectCountWithExpl).toFixed(1)}%`);
  console.log(`  MACD: ${(macdAvgIncorrect / incorrectCountWithExpl).toFixed(1)}%`);
  console.log(`  Volatility: ${(volAvgIncorrect / incorrectCountWithExpl).toFixed(1)}%`);
  console.log(`  Volume: ${(volumeAvgIncorrect / incorrectCountWithExpl).toFixed(1)}%`);
}
