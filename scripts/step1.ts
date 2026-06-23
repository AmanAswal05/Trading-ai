/* eslint-disable @typescript-eslint/no-explicit-any */
import { generatePrediction } from '../lib/prediction-engine';

const history = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - i * 86400000).toISOString(),
  open: 100, high: 110, low: 90,
  close: 100 + Math.sin(i) * 10,
  volume: 1000000,
}));

let noSignal = 0, weak = 0, mod = 0, strong = 0;
let minConf = 100, maxConf = 0, sumConf = 0;

for (let i = 0; i < 100; i++) {
  const indicators = {
    rsi14: Math.random() * 100,
    macd: { histogram: Math.random() * 2 - 1 },
    sma20: 100 + Math.random() * 20 - 10,
    sma50: 100 + Math.random() * 20 - 10,
    sma200: 100 + Math.random() * 20 - 10,
    ema12: 100 + Math.random() * 20 - 10,
    ema26: 100 + Math.random() * 20 - 10,
    bollingerUpper: 120,
    bollingerMiddle: 100,
    bollingerLower: 80,
    atr14: Math.random() * 5,
    stochasticK: Math.random() * 100,
    stochasticD: Math.random() * 100,
    williamsR: Math.random() * -100,
  };
  
  const pred = generatePrediction('AAPL', 100, 1000000, history, indicators as any, undefined, 'V1', '7D');
  
  const conf = pred.confidence;
  if (conf < minConf) minConf = conf;
  if (conf > maxConf) maxConf = conf;
  sumConf += conf;

  const signal = pred.signalStrength;
  if (signal === 'NO_SIGNAL') noSignal++;
  else if (signal === 'WEAK_SIGNAL') weak++;
  else if (signal === 'MODERATE_SIGNAL') mod++;
  else if (signal === 'STRONG_SIGNAL') strong++;
}

console.log("\nCounts:");
console.log("NO_SIGNAL:", noSignal);
console.log("WEAK_SIGNAL:", weak);
console.log("MODERATE_SIGNAL:", mod);
console.log("STRONG_SIGNAL:", strong);
console.log("Min Conf:", minConf);
console.log("Max Conf:", maxConf);
console.log("Avg Conf:", sumConf / 100);
