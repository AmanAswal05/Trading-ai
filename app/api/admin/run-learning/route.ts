/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { PredictionsDbService } from '@/lib/predictions-db';
import { supabase } from '@/lib/supabase';
import {
  analyzeIndicatorPerformance,
  computeAdaptiveWeights,
  saveWeightSnapshot,
  loadCurrentWeights
} from '@/lib/adaptive-weights';
import { getAuthenticatedAdmin } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedAdmin(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    const origin = request.nextUrl.origin;

    // 1. Verify expired predictions
    console.log('[LearningJob] Automatically verifying expired predictions...');
    const newlyVerifiedCount = await PredictionsDbService.autoVerifyExpired(origin);

    // 2. Fetch all predictions to analyze historical performance
    const allPredictions = await PredictionsDbService.getAllPredictions();
    const verifiedPredictions = allPredictions.filter(p => p.status === 'VERIFIED');

    if (verifiedPredictions.length === 0) {
      return NextResponse.json({
        message: 'No verified predictions found in the database. Add verified predictions or run backtest seeder first.',
        newlyVerifiedCount,
        weightsUpdated: false
      });
    }

    // 3. Analyze indicator accuracy & reliability scores
    console.log('[LearningJob] Analyzing indicator performance scores...');
    const performances = analyzeIndicatorPerformance(verifiedPredictions);

    // 4. Compute overall system accuracy (win rate)
    const correctCount = verifiedPredictions.filter(p => p.prediction_result === 'CORRECT').length;
    const partialCount = verifiedPredictions.filter(p => p.prediction_result === 'PARTIALLY_CORRECT').length;
    const incorrectCount = verifiedPredictions.filter(p => p.prediction_result === 'INCORRECT').length;
    const evaluatedCount = correctCount + partialCount + incorrectCount;
    const systemAccuracy = evaluatedCount > 0
      ? ((correctCount + partialCount * 0.5) / evaluatedCount) * 100
      : 0;

    // 5. Compute new adaptive weights using update formulas
    const currentWeights = loadCurrentWeights();
    console.log('[LearningJob] Adjusting weights based on performance delta...');
    const newWeights = computeAdaptiveWeights(performances, currentWeights);
    // 6. Save weight snapshot to history
    saveWeightSnapshot(newWeights, systemAccuracy, verifiedPredictions.length, performances);

    // 7. Sync with SQL database if configured
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-url')) {
      try {
        console.log('[LearningJob] Syncing indicator performance to Supabase...');
        for (const perf of performances) {
          const { error } = await supabase
            .from('indicator_performance')
            .upsert({
              indicator_name: perf.indicator_name,
              current_weight: perf.current_weight,
              previous_weight: perf.previous_weight,
              accuracy_score: perf.accuracy_score,
              reliability_score: perf.reliability_score,
              last_updated: new Date().toISOString()
            }, { onConflict: 'indicator_name' });

          if (error) {
            console.error(`[LearningJob] Database sync failed for ${perf.indicator_name}:`, error.message);
          }
        }
      } catch (dbErr: any) {
        console.error('[LearningJob] Database sync error:', dbErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully completed learning cycle. Verified ${newlyVerifiedCount} pending predictions.`,
      newlyVerifiedCount,
      systemAccuracy: Number(systemAccuracy.toFixed(2)),
      totalVerified: verifiedPredictions.length,
      previousWeights: currentWeights,
      updatedWeights: newWeights,
      indicatorPerformance: performances
    });
  } catch (err: any) {
    console.error('[LearningJob] Learning cycle failed:', err);
    return NextResponse.json({ error: err.message || 'Failed to execute learning cycle.' }, { status: 500 });
  }
}
