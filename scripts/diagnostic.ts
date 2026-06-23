import { readFileSync } from 'fs';
import { resolve } from 'path';

const dbPath = resolve(__dirname, '../lib/mock-predictions-db.json');
const data = JSON.parse(readFileSync(dbPath, 'utf8'));

let noSignal = 0;
let weakSignal = 0;
let moderateSignal = 0;
let strongSignal = 0;
let tradeable = 0;
let tradeableCorrect = 0;
let tradeableEvaluated = 0;
let filteredCount = 0;

let minConfidence = 100;
let maxConfidence = 0;
let sumConfidence = 0;

for (const p of data) {
  const conf = p.confidence_score;
  if (conf < minConfidence) minConfidence = conf;
  if (conf > maxConfidence) maxConfidence = conf;
  sumConfidence += conf;
  
  if (p.signal_strength === 'NO_SIGNAL') noSignal++;
  else if (p.signal_strength === 'WEAK_SIGNAL') weakSignal++;
  else if (p.signal_strength === 'MODERATE_SIGNAL') moderateSignal++;
  else if (p.signal_strength === 'STRONG_SIGNAL') strongSignal++;

  const isTradeable = p.is_tradeable_signal;
  if (isTradeable) {
    tradeable++;
    if (p.prediction_result === 'CORRECT') tradeableCorrect++;
    if (p.prediction_result === 'CORRECT' || p.prediction_result === 'INCORRECT' || p.prediction_result === 'PARTIALLY_CORRECT') {
      tradeableEvaluated++;
    }
  } else {
    filteredCount++;
  }
}

console.log("=== STEP 2 & 6: DIAGNOSTIC REPORT ===");
console.log("Total Predictions:", data.length);
console.log("NO_SIGNAL Count:", noSignal);
console.log("WEAK_SIGNAL Count:", weakSignal);
console.log("MODERATE_SIGNAL Count:", moderateSignal);
console.log("STRONG_SIGNAL Count:", strongSignal);
console.log("Filtered Predictions:", filteredCount);
console.log("Tradeable Signals:", tradeable);
console.log("Tradeable Accuracy:", tradeableEvaluated > 0 ? (tradeableCorrect / tradeableEvaluated) * 100 : 0, "%");

console.log("\n=== STEP 3: VALIDATE CONFIDENCE VALUES ===");
console.log("Minimum confidence:", minConfidence);
console.log("Maximum confidence:", maxConfidence);
console.log("Average confidence:", (sumConfidence / data.length).toFixed(2));

