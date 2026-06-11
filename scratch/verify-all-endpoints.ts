import { GET as getPredict } from '../app/api/predict/[ticker]/route';
import { POST as runVerify } from '../app/api/admin/verify/route';
import { POST as runBacktest } from '../app/api/admin/backtest/route';
import { GET as getAccuracyStats } from '../app/api/admin/accuracy-stats/route';
import { GET as getTrustStats } from '../app/api/public/trust-stats/route';
import { NextRequest } from 'next/server';
import { PredictionsDbService } from '../lib/predictions-db';

async function testAll() {
  const origin = 'http://localhost:3000';
  console.log('=== STARTING COMPLETE API AUDIT ===\n');

  // 1. TEST PREDICT ENDPOINT
  try {
    console.log('1. Testing Predict Endpoint (/api/predict/AAPL)...');
    const req = new NextRequest(`${origin}/api/predict/AAPL?timeframe=7D&model=V1`);
    const res = await getPredict(req, { params: Promise.resolve({ ticker: 'AAPL' }) });
    console.log(`   Status: ${res.status}`);
    const data = await res.json();
    console.log(`   Output Keys: ${Object.keys(data).join(', ')}`);
    console.log(`   Predicted Direction: ${data.direction}, Price: ${data.predictedPrice}\n`);
  } catch (err) {
    console.error('   Predict Endpoint Error:', err);
  }

  // 2. TEST BACKTEST SEEDER
  try {
    console.log('2. Testing Backtest Seeder (/api/admin/backtest)...');
    const req = new NextRequest(`${origin}/api/admin/backtest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers: ['AAPL'] }), // just seed AAPL for speed
    });
    // Inject mock user cookie to bypass admin auth in mock mode
    req.cookies.set('sp_mock_user', 'admin@stockpredict.ai');
    
    const res = await runBacktest(req);
    console.log(`   Status: ${res.status}`);
    const data = await res.json();
    console.log(`   Seeded Result: ${data.message || data.error}`);
    console.log(`   Records Seeded: ${data.recordsSeeded}, Verified: ${data.verifiedCount}\n`);
  } catch (err) {
    console.error('   Backtest Seeder Error:', err);
  }

  // 3. TEST VERIFICATION ENGINE
  try {
    console.log('3. Testing Verification Engine (/api/admin/verify)...');
    const req = new NextRequest(`${origin}/api/admin/verify`, { method: 'POST' });
    req.cookies.set('sp_mock_user', 'admin@stockpredict.ai');
    
    const res = await runVerify(req);
    console.log(`   Status: ${res.status}`);
    const data = await res.json();
    console.log(`   Verify Result: ${data.message || data.error}`);
    console.log(`   Verified Count: ${data.verifiedCount}\n`);
  } catch (err) {
    console.error('   Verification Engine Error:', err);
  }

  // 4. TEST ADMIN ACCURACY STATS
  try {
    console.log('4. Testing Admin Accuracy Stats (/api/admin/accuracy-stats)...');
    const req = new NextRequest(`${origin}/api/admin/accuracy-stats?timeframe=ALL`);
    req.cookies.set('sp_mock_user', 'admin@stockpredict.ai');
    
    const res = await getAccuracyStats(req);
    console.log(`   Status: ${res.status}`);
    const data = await res.json();
    console.log(`   Accuracy Stats: Total Verified = ${data.totalCount}, Overall Accuracy = ${data.accuracy}%`);
    console.log(`   Win/Loss Ratio: ${data.winLossRatio}, Average Error: ${data.avgError}%\n`);
  } catch (err) {
    console.error('   Admin Stats Error:', err);
  }

  // 5. TEST PUBLIC TRUST STATS
  try {
    console.log('5. Testing Public Trust Stats (/api/public/trust-stats)...');
    const req = new NextRequest(`${origin}/api/public/trust-stats`);
    const res = await getTrustStats(req);
    console.log(`   Status: ${res.status}`);
    const data = await res.json();
    console.log(`   Public Stats: Accuracy = ${data.accuracy}%, Total Verified Count = ${data.totalCount}`);
    console.log(`   Average Confidence = ${data.avgConfidence}%`);
    console.log(`   Recent Verified Logs Count: ${data.recentVerified?.length}\n`);
  } catch (err) {
    console.error('   Public Trust Stats Error:', err);
  }

  console.log('=== COMPLETE API AUDIT FINISHED ===');
}

testAll();
