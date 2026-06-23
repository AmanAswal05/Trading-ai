/* eslint-disable @typescript-eslint/no-explicit-any */
import { generatePrediction } from '../lib/prediction-engine';
const history = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - i * 86400000).toISOString(),
  open: 100, high: 110, low: 90,
  close: 100 + Math.sin(i) * 10,
  volume: 1000000,
}));
const indicators = { rsi14: 60, macd: { histogram: 0.5 }, sma20: 90, sma50: 80, sma200: 70, ema12: 95, ema26: 90, bollingerUpper: 120, bollingerMiddle: 100, bollingerLower: 80, atr14: 1.5, stochasticK: 60, stochasticD: 50, williamsR: -20, obv: 0 };
const pred = generatePrediction('AAPL', 100, 1000000, history, indicators as any, undefined, 'V1', '7D');
console.log(pred);
