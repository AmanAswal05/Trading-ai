import { NextRequest, NextResponse } from 'next/server';
import { PredictionsDbService } from '@/lib/predictions-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const stats = await PredictionsDbService.getVerificationStats('ALL', origin);
    
    // Fetch recently verified predictions for public auditing
    const allPredictions = await PredictionsDbService.getAllPredictions();
    const verifiedPredictions = allPredictions
      .filter(r => r.status === 'VERIFIED')
      .sort((a, b) => new Date(b.verification_date || '').getTime() - new Date(a.verification_date || '').getTime())
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        ticker: r.ticker,
        prediction_date: r.prediction_date,
        timeframe: r.timeframe,
        current_price: r.current_price,
        predicted_price: r.predicted_price,
        predicted_direction: r.predicted_direction,
        confidence_score: r.confidence_score,
        actual_price: r.actual_price,
        actual_direction: r.actual_direction,
        prediction_result: r.prediction_result,
        error_percentage: r.error_percentage,
        verification_date: r.verification_date,
      }));

    // Calculate average confidence score
    const allVerified = allPredictions.filter(r => r.status === 'VERIFIED');
    const avgConfidence = allVerified.length > 0
      ? allVerified.reduce((s, r) => s + r.confidence_score, 0) / allVerified.length
      : 0;

    return NextResponse.json({
      accuracy: stats.accuracy,
      totalCount: stats.totalCount,
      avgConfidence: Number(avgConfidence.toFixed(1)),
      confidenceCalibration: stats.confidenceCalibration,
      accuracyTrend: stats.accuracyTrend,
      recentVerified: verifiedPredictions,
      accuracyByModel: stats.accuracyByModel,
      avgError: stats.avgError,
      medianError: stats.medianError,
    });
  } catch (err: any) {
    console.error('Failed to fetch public trust stats:', err);
    return NextResponse.json({ error: err.message || 'Failed to retrieve trust statistics.' }, { status: 500 });
  }
}
