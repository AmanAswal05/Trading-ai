import { NextRequest, NextResponse } from 'next/server';
import { PredictionsDbService } from '@/lib/predictions-db';
import { analyzeFeaturePerformance } from '@/lib/feature-performance';
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

    const report = analyzeFeaturePerformance(verifiedPredictions);

    return NextResponse.json(report);
  } catch (err: any) {
    console.error('Failed to fetch feature performance stats:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch feature performance.' }, { status: 500 });
  }
}
