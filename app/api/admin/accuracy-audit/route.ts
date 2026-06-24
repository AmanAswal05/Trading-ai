import { NextRequest, NextResponse } from 'next/server';
import { PredictionsDbService } from '@/lib/predictions-db';
import { runAccuracyAudit } from '@/lib/accuracy-audit';
import { getAuthenticatedAdmin } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedAdmin(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    const allPredictions = await PredictionsDbService.getAllPredictions();
    const verified = allPredictions.filter(p => p.status === 'VERIFIED');

    const report = runAccuracyAudit(verified);

    const stalePredictionCount = allPredictions.filter(p => !p.engineVersion).length;
    const latestPredictionCount = allPredictions.length - stalePredictionCount;

    return NextResponse.json({
      ...report,
      stalePredictionCount,
      latestPredictionCount,
      totalPredictionsCount: allPredictions.length,
    });
  } catch (err: any) {
    console.error('Failed to run accuracy audit:', err);
    return NextResponse.json({ error: err.message || 'Failed to run accuracy audit.' }, { status: 500 });
  }
}
