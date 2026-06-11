const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const COOKIE = 'sp_mock_user=admin@stockpredict.ai';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest(datesCount: number, label: string) {
  console.log(`\n====================================`);
  console.log(`STARTING STRESS TEST: ${label}`);
  console.log(`====================================`);
  
  const startTime = Date.now();
  
  const res = await fetch(`${BASE_URL}/api/admin/backtest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': COOKIE
    },
    body: JSON.stringify({
      tickers: datesCount === 7 ? ['AAPL'] : ['AAPL', 'MSFT', 'TSLA', 'RELIANCE.BSE', 'NIFTY', 'GOOGL', 'AMZN'],
      simulationDatesCount: datesCount
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to start job: ${res.status} - ${text}`);
    return;
  }

  const startData = await res.json();
  const jobId = startData.jobId;
  console.log(`Job Created: ${jobId} (Total Records Expected: ${startData.totalRecords})`);

  let completed = false;
  let jobStatus: any = null;

  while (!completed) {
    await sleep(250);
    const statusRes = await fetch(`${BASE_URL}/api/admin/backtest?jobId=${jobId}`, {
      headers: {
        'Cookie': COOKIE
      }
    });

    if (!statusRes.ok) {
      console.error(`Failed to poll status for ${jobId}`);
      continue;
    }

    jobStatus = await statusRes.json();
    console.log(`[${jobStatus.status}] Progress: ${jobStatus.progress}% | Processed: ${jobStatus.recordsProcessed}/${jobStatus.totalRecords} | Verified: ${jobStatus.recordsVerified} | Time: ${(jobStatus.executionTime / 1000).toFixed(2)}s`);

    if (jobStatus.status === 'COMPLETED' || jobStatus.status === 'FAILED' || jobStatus.status === 'CANCELLED') {
      completed = true;
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\n====================================`);
  console.log(`STRESS TEST FINISHED: ${label}`);
  console.log(`Total Duration: ${duration.toFixed(2)} seconds`);
  console.log(`Status: ${jobStatus?.status}`);
  console.log(`Records Processed: ${jobStatus?.recordsProcessed}`);
  console.log(`Records Verified: ${jobStatus?.recordsVerified}`);
  console.log(`Success Rate: ${jobStatus?.successRate}%`);
  console.log(`Database Writes: ${jobStatus?.databaseWrites}`);
  console.log(`Failures Logged: ${jobStatus?.failures?.length || 0}`);
  console.log(`====================================\n`);
  
  return jobStatus;
}

async function main() {
  console.log("Starting Stress Test Runner...");
  try {
    // 100 Predictions (Quick)
    await runTest(7, "100 Predictions (Quick)");
    
    // 1,000 Predictions (Medium)
    await runTest(10, "1,000 Predictions (Medium)");
    
    // 10,000 Predictions (Stress)
    await runTest(95, "10,000 Predictions (Stress)");
    
  } catch (err) {
    console.error("Stress test execution error:", err);
  }
}

main();
