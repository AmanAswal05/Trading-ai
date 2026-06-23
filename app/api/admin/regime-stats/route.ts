/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { PredictionsDbService } from '@/lib/predictions-db';
import { getRegimeLabel, MarketRegime } from '@/lib/regime-detector';
import { deriveMarketRegime } from '@/lib/prediction-analytics';
import { getAuthenticatedAdmin } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';

const REGIMES: MarketRegime[] = [
  'BULL', 'BEAR', 'SIDEWAYS', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'TRENDING', 'MEAN_REVERTING',
];

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedAdmin(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });

  try {
    const allPredictions = await PredictionsDbService.getAllPredictions();
    const verified = allPredictions.filter(prediction => prediction.status === 'VERIFIED');

    const regimes = REGIMES.map(regime => {
      const records = verified.filter(record => deriveMarketRegime(record) === regime);
      const correct = records.filter(record => record.prediction_result === 'CORRECT').length;
      const incorrect = records.filter(record => record.prediction_result === 'INCORRECT').length;
      const partial = records.filter(record => record.prediction_result === 'PARTIALLY_CORRECT').length;
      const neutral = records.filter(record => record.prediction_result === 'NEUTRAL').length;
      const evaluated = correct + incorrect + partial;
      const errors = records.flatMap(record => typeof record.error_percentage === 'number' ? [record.error_percentage] : []);

      return {
        regime,
        label: getRegimeLabel(regime),
        total_predictions: records.length,
        correct_predictions: correct,
        incorrect_predictions: incorrect,
        partial_predictions: partial,
        neutral_predictions: neutral,
        accuracy_score: evaluated > 0 ? Number((((correct + partial * 0.5) / evaluated) * 100).toFixed(1)) : null,
        avg_error_percentage: errors.length > 0 ? Number((errors.reduce((sum, error) => sum + error, 0) / errors.length).toFixed(2)) : null,
        data_status: evaluated === 0 ? 'NO_VERIFIED_DATA' : evaluated < 20 ? 'UNRELIABLE' : 'RELIABLE',
      };
    });

    const latestClassified = [...allPredictions]
      .filter(record => REGIMES.includes(deriveMarketRegime(record) as MarketRegime))
      .sort((a, b) => new Date(b.prediction_date).getTime() - new Date(a.prediction_date).getTime())[0];
    const currentRegime = latestClassified
      ? {
          regime: deriveMarketRegime(latestClassified),
          label: getRegimeLabel(deriveMarketRegime(latestClassified) as MarketRegime),
          confidence: null,
          asOf: latestClassified.prediction_date,
        }
      : null;

    return NextResponse.json({
      regimes,
      currentRegime,
      unclassifiedVerifiedCount: verified.filter(record => deriveMarketRegime(record) === 'UNKNOWN').length,
    });
  } catch (err: any) {
    console.error('Failed to compute regime stats:', err);
    return NextResponse.json({ error: err.message || 'Failed to compute regime statistics.' }, { status: 500 });
  }
}
