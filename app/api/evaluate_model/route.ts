import { NextRequest, NextResponse } from 'next/server';
import { buildCalibrationCurve } from '@/lib/confidenceCalibration';
import { buildIntegrityWarnings } from '@/lib/data-integrity';
import { buildPredictionAnalyticsReport } from '@/lib/prediction-analytics';
import { PredictionsDbService } from '@/lib/predictions-db';
import { getAuthenticatedAdmin } from '@/lib/admin-api-auth';
import { computeDirectionalBrierScore, parseEvaluationBatchSize } from '@/lib/model-evaluation';

export const dynamic = 'force-dynamic';

async function evaluate(request: NextRequest, requestedBatchSize?: unknown) {
  const user = await getAuthenticatedAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  const batchSize = parseEvaluationBatchSize(requestedBatchSize ?? request.nextUrl.searchParams.get('batchSize'));
  if (batchSize === null) {
    return NextResponse.json(
      { error: 'Invalid batch size. Choose 100, 1,000, 10,000, or 100,000.' },
      { status: 400 }
    );
  }

  const startTime = Date.now();
  const limit = Math.min(batchSize * 2, 50000); // Fetch enough to sort by date
  
  // Requirement 4 & 5: use fast database reads and pass limit
  const verifiedRows = await PredictionsDbService.getVerifiedPredictions(limit);
  
  const verified = verifiedRows
    .sort((a, b) => {
      const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
      const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
      if (aCreated !== bCreated) return bCreated - aCreated;
      
      const aVerif = a.verification_date ? Date.parse(a.verification_date) : 0;
      const bVerif = b.verification_date ? Date.parse(b.verification_date) : 0;
      if (aVerif !== bVerif) return bVerif - aVerif;
      
      const aPred = a.prediction_date ? Date.parse(a.prediction_date) : 0;
      const bPred = b.prediction_date ? Date.parse(b.prediction_date) : 0;
      return bPred - aPred;
    })
    .slice(0, batchSize);

  // Requirement 10: Log the slow endpoint and duration on server side
  const fetchDuration = Date.now() - startTime;
  if (fetchDuration > 2000) {
    console.warn(`[SLOW ENDPOINT] /api/evaluate_model took ${fetchDuration}ms to fetch ${verifiedRows.length} rows`);
  }

  const analytics = buildPredictionAnalyticsReport(verified);
  const calibration = buildCalibrationCurve(verified);
  const brierScore = computeDirectionalBrierScore(verified);

  return NextResponse.json({
    batchSize,
    evaluatedRows: verified.length,
    generatedAt: new Date().toISOString(),
    ...analytics,
    brierScore,
    reliabilityCurve: calibration.buckets,
    calibrationError: calibration.overallCalibrationError,
    // Expose top-level counts used by the Admin dashboard metric cards.
    tradeableCount: analytics.tradeablePredictionsCount,
    integrityWarnings: buildIntegrityWarnings(verified),
  });
}

export async function GET(request: NextRequest) {
  return evaluate(request);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return evaluate(request, body.batchSize ?? body.batch_size);
}
