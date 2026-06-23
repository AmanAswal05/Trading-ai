import { NextRequest, NextResponse } from 'next/server';
import { PredictionsDbService } from '@/lib/predictions-db';
import {
  analyzeIndicatorPerformance,
  getWeightHistory,
  loadCurrentWeights
} from '@/lib/adaptive-weights';
import { getAuthenticatedAdmin } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedAdmin(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    const allPredictions = await PredictionsDbService.getAllPredictions();
    const verifiedPredictions = allPredictions.filter(p => p.status === 'VERIFIED');

    // Calculate latest indicator rankings
    const rankings = analyzeIndicatorPerformance(verifiedPredictions);

    // Retrieve weight adjustment history
    const history = getWeightHistory();
    const currentWeights = loadCurrentWeights();

    return NextResponse.json({
      rankings,
      history,
      currentWeights
    });
  } catch (err: any) {
    console.error('Failed to fetch indicator performance stats:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch indicator performance.' }, { status: 500 });
  }
}
