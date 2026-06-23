import { readFileSync } from 'fs';
import { resolve } from 'path';

const dbPath = resolve(__dirname, '../lib/mock-predictions-db.json');
const data = JSON.parse(readFileSync(dbPath, 'utf8'));

// Filter verified and get last 10,000
const verified = data
  .filter((r: any) => r.status === 'VERIFIED')
  .sort((a: any, b: any) => Date.parse(a.verification_date ?? a.prediction_date) - Date.parse(b.verification_date ?? b.prediction_date))
  .slice(-10000);

let tradeable = 0;
let filtered = 0;
let noSignal = 0;
let weakSignal = 0;
let modSignal = 0;
let strongSignal = 0;

for (const p of verified) {
  // logic from prediction-analytics.ts isTradeableRecord
  let isT = false;
  if (typeof p.is_tradeable_signal === 'boolean') {
    isT = p.is_tradeable_signal;
  } else {
    const tf = p.timeframe;
    if (tf === '1D') isT = false;
    else {
      const conf = Math.max(p.confidence_score, 100 - p.confidence_score);
      if (conf < 60) isT = false;
      else {
        let signal = p.signal_strength;
        if (!signal) {
          if (p.confidence_score < 55) signal = 'NO_SIGNAL';
          else if (p.confidence_score < 65) signal = 'WEAK_SIGNAL';
          else if (p.confidence_score < 75) signal = 'MODERATE_SIGNAL';
          else signal = 'STRONG_SIGNAL';
        }
        isT = signal === 'MODERATE_SIGNAL' || signal === 'STRONG_SIGNAL';
      }
    }
  }

  if (isT) tradeable++;
  else filtered++;

  let signal = p.signal_strength;
  if (!signal) {
    if (p.confidence_score < 55) signal = 'NO_SIGNAL';
    else if (p.confidence_score < 65) signal = 'WEAK_SIGNAL';
    else if (p.confidence_score < 75) signal = 'MODERATE_SIGNAL';
    else signal = 'STRONG_SIGNAL';
  }

  if (signal === 'NO_SIGNAL') noSignal++;
  else if (signal === 'WEAK_SIGNAL') weakSignal++;
  else if (signal === 'MODERATE_SIGNAL') modSignal++;
  else if (signal === 'STRONG_SIGNAL') strongSignal++;
}

console.log("Verified Predictions:", verified.length);
console.log("Tradeable:", tradeable);
console.log("Filtered:", filtered);
console.log("NO_SIGNAL:", noSignal);
console.log("WEAK_SIGNAL:", weakSignal);
console.log("MODERATE_SIGNAL:", modSignal);
console.log("STRONG_SIGNAL:", strongSignal);
