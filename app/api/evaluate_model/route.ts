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

  const allPredictions = await PredictionsDbService.getAllPredictions();
  const verified = allPredictions
    .filter(record => record.status === 'VERIFIED')
    .sort((a, b) => Date.parse(a.verification_date ?? a.prediction_date) - Date.parse(b.verification_date ?? b.prediction_date))
    .slice(-batchSize);

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
