import { PredictionsDbService } from '../lib/predictions-db';
import { buildPredictionAnalyticsReport } from '../lib/prediction-analytics';
import { buildCalibrationCurve } from '../lib/confidenceCalibration';

async function run() {
  const all = await PredictionsDbService.getAllPredictions();
  const verified = all
    .filter(record => record.status === 'VERIFIED')
    .sort((a, b) => Date.parse(a.verification_date ?? a.prediction_date) - Date.parse(b.verification_date ?? b.prediction_date))
    .slice(-10000);

  const analytics = buildPredictionAnalyticsReport(verified);
  const calibration = buildCalibrationCurve(verified);
  
  console.log("Tradeable Signal Count:", analytics.tradeablePredictionsCount);
  console.log("Tradeable Signal Accuracy:", analytics.tradeableAccuracy + "%");
  console.log("Win/Loss Ratio:", analytics.winLossRatioAfterFiltering);
  console.log("Calibration Error:", calibration.overallCalibrationError);
  console.log("Overall Accuracy:", analytics.overallAccuracy + "%");
}
run();
