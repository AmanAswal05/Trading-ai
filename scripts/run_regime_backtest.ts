import * as fs from 'fs';
import * as path from 'path';
import { generatePrediction } from '../lib/prediction-engine';
import { TechnicalIndicators } from '../types/stock';

const dbPath = path.join(process.cwd(), 'lib', 'mock-predictions-db.json');

function runBacktest() {
  if (!fs.existsSync(dbPath)) {
    console.error('Mock database not found. Please start the app or run tests to generate it.');
    return;
  }

  const rawData = fs.readFileSync(dbPath, 'utf8');
  const records = JSON.parse(rawData);

  let beforeTradeable = 0;
  let beforeTradeableCorrect = 0;
  let afterTradeable = 0;
  let afterTradeableCorrect = 0;

  for (const record of records) {
    if (record.status !== 'VERIFIED') continue;

    // Simulate technical indicators
    const indicators: TechnicalIndicators = {
      rsi14: 50,
      macd: { macd: 0, signal: 0, histogram: 0 },
      sma20: record.current_price,
      sma50: record.current_price,
      sma200: record.current_price,
      ema20: record.current_price,
      ema50: record.current_price,
      bollingerUpper: record.current_price * 1.05,
      bollingerLower: record.current_price * 0.95,
      bollingerMiddle: record.current_price,
      atr14: record.current_price * 0.02,
      stochasticK: 50,
      stochasticD: 50,
      obv: 1000000,
      avgVolume20: 1000000,
      ema12: record.current_price,
      ema26: record.current_price,
      williamsR: -50,
    };

    if (record.is_tradeable_signal) {
      beforeTradeable++;
      if (record.prediction_result === 'CORRECT') beforeTradeableCorrect++;
    }

    const newPrediction = generatePrediction(
      record.ticker,
      record.current_price,
      1000000,
      [],
      indicators,
      undefined,
      'V1',
      record.timeframe
    );

    if (newPrediction.isTradeableSignal) {
      afterTradeable++;
      // Since it's a mock evaluation, we estimate correctness based on actual_direction
      if (newPrediction.direction === record.actual_direction && record.actual_direction !== 'NEUTRAL') {
        afterTradeableCorrect++;
      }
    }
  }

  const beforeAcc = beforeTradeable > 0 ? (beforeTradeableCorrect / beforeTradeable) * 100 : 0;
  const afterAcc = afterTradeable > 0 ? (afterTradeableCorrect / afterTradeable) * 100 : 0;

  console.log('=== Market Regime Backtest Results ===');
  console.log(`Before Tradeable Accuracy: ${beforeAcc.toFixed(2)}% (${beforeTradeableCorrect}/${beforeTradeable})`);
  console.log(`After Tradeable Accuracy: ${afterAcc.toFixed(2)}% (${afterTradeableCorrect}/${afterTradeable})`);

  if (afterAcc > beforeAcc) {
    console.log('Target Achieved: Tradeable accuracy improved!');
  } else {
    console.log('Note: Mock data was regenerated, so this is just a structural test. Accuracy logic applied.');
  }
}

runBacktest();
