import { runAccuracyAudit } from '../lib/accuracy-audit';
import { PredictionsDbService } from '../lib/predictions-db';

async function main() {
  console.log('==============================================');
  console.log('   ACCURACY AUDIT AND ANTI-OVERFITTING TOOL');
  console.log('==============================================');
  console.log('Fetching verified predictions...');

  const allPredictions = await PredictionsDbService.getAllPredictions();
  const verified = allPredictions.filter(p => p.status === 'VERIFIED');

  console.log(`Found ${verified.length} verified predictions in the database.`);
  console.log('Running audit logic...\n');

  const report = runAccuracyAudit(verified);

  const printBadge = (name: string, status: string) => {
    let color = '\x1b[33m'; // Yellow
    if (status === 'PASS') color = '\x1b[32m'; // Green
    if (status === 'FAIL') color = '\x1b[31m'; // Red
    console.log(`${name.padEnd(25)} : ${color}[ ${status} ]\x1b[0m`);
  };

  console.log('--- METRICS ---');
  console.log(`Total Verified        : ${report.totalVerified}`);
  console.log(`Mock/Fallback Excluded: ${report.mockExclusionCount}`);
  console.log(`Overall Accuracy      : ${report.overallAccuracy}%`);
  console.log(`Tradeable Accuracy    : ${report.tradeableAccuracy}%`);
  console.log(`Avg Conf (Correct)    : ${report.averageConfidenceCorrect.toFixed(1)}`);
  console.log(`Avg Conf (Incorrect)  : ${report.averageConfidenceIncorrect.toFixed(1)}`);
  console.log(`Calibration Error     : ${report.calibrationError}\n`);

  console.log('--- AUDIT BADGES ---');
  printBadge('Data Integrity', report.badges.dataIntegrity);
  printBadge('No Leakage', report.badges.noLeakage);
  printBadge('Calibration Health', report.badges.calibrationHealth);
  printBadge('Sample Size Health', report.badges.sampleSizeHealth);
  printBadge('Overfitting Risk', report.badges.overfittingRisk);
  console.log('');

  if (report.failureReasons.length > 0) {
    console.log('\x1b[31m--- FAILURE REASONS & WARNINGS ---\x1b[0m');
    report.failureReasons.forEach(r => console.log(`- ${r}`));
  } else {
    console.log('\x1b[32mAll audit checks passed successfully!\x1b[0m');
  }
  
  console.log('\nAudit complete.');
  
  const hasFailures = Object.values(report.badges).some(b => b === 'FAIL');
  if (hasFailures) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Audit script failed:', err);
  process.exit(1);
});
