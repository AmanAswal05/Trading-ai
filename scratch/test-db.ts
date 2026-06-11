import { PredictionsDbService } from '../lib/predictions-db';

async function test() {
  try {
    console.log('Fetching stats...');
    const stats = await PredictionsDbService.getVerificationStats('ALL');
    console.log('Stats:', JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
