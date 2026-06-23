import { PredictionsDbService } from '../lib/predictions-db';
import { buildFailureAnalysisReport } from '../lib/failureAnalysis';

async function test() {
  const all = await PredictionsDbService.getAllPredictions();
  const verified = all.filter(p => p.status === 'VERIFIED');
  console.log(`Found ${verified.length} verified predictions.`);
  
  const report = buildFailureAnalysisReport(verified);
  console.log('Top Failure Reasons:');
  console.log(report.topFailureReasons);
  
  const badStocks = report.stocks.filter(s => s.accuracy < 50);
  console.log(`Found ${badStocks.length} stocks with accuracy < 50%.`);
}

test().catch(console.error);
