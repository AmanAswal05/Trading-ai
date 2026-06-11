import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { PredictionsDbService } from '@/lib/predictions-db';
import { detectRegime, getRegimeLabel, MarketRegime } from '@/lib/regime-detector';

export const dynamic = 'force-dynamic';

async function getUser(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-url')) {
    const mockUserCookie = request.cookies.get('sp_mock_user');
    if (mockUserCookie) {
      try {
        const email = decodeURIComponent(mockUserCookie.value);
        return { id: 'mock-user-id', email };
      } catch (e) {
        console.error('Failed to parse mock user cookie:', e);
      }
    }
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (err) {
    console.error('Auth check error:', err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);

  if (!user || !user.email || !(user.email.toLowerCase().includes('admin') || user.email.toLowerCase().endsWith('@stockpredict.ai'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    const allPredictions = await PredictionsDbService.getAllPredictions();
    const verified = allPredictions.filter(p => p.status === 'VERIFIED');

    // Define all regimes
    const regimesList: MarketRegime[] = [
      'BULL', 'BEAR', 'SIDEWAYS', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'TRENDING', 'MEAN_REVERTING'
    ];

    // Initialize statistics
    const stats: Record<string, {
      regime: string;
      label: string;
      total_predictions: number;
      correct_predictions: number;
      partial_predictions: number;
      accuracy_score: number;
      avg_error_percentage: number;
    }> = {};

    for (const reg of regimesList) {
      stats[reg] = {
        regime: reg,
        label: getRegimeLabel(reg),
        total_predictions: 0,
        correct_predictions: 0,
        partial_predictions: 0,
        accuracy_score: 50,
        avg_error_percentage: 0
      };
    }

    // Process verified predictions and assign to regimes
    for (const record of verified) {
      const summaryText = record.explanation?.ai_reasoning_summary || '';
      let assignedRegime: MarketRegime | null = null;

      // Extract regime from reasoning text (e.g., "Under the BULL regime...")
      for (const reg of regimesList) {
        if (summaryText.includes(reg)) {
          assignedRegime = reg;
          break;
        }
      }

      // Fallback: If not specified in summary, check price vs sma200 or assign to SIDEWAYS
      if (!assignedRegime) {
        if (record.current_price && record.explanation?.trend_contribution) {
          assignedRegime = record.explanation.trend_contribution > 15 ? 'BULL' : 'BEAR';
        } else {
          assignedRegime = 'SIDEWAYS';
        }
      }

      const stat = stats[assignedRegime];
      stat.total_predictions++;
      if (record.prediction_result === 'CORRECT') {
        stat.correct_predictions++;
      } else if (record.prediction_result === 'PARTIALLY_CORRECT') {
        stat.partial_predictions++;
      }
      stat.avg_error_percentage += record.error_percentage || 0;
    }

    // Finalize statistics calculation
    const reportList = Object.values(stats).map(s => {
      const total = s.total_predictions;
      const correct = s.correct_predictions;
      const partial = s.partial_predictions;
      const directionalCount = total; // Assume all are directional

      const accuracy_score = directionalCount > 0
        ? Number(((correct + partial * 0.5) / directionalCount * 100).toFixed(1))
        : 50;

      const avg_error_percentage = total > 0
        ? Number((s.avg_error_percentage / total).toFixed(2))
        : 0;

      return {
        ...s,
        accuracy_score,
        avg_error_percentage
      };
    });

    // We can also estimate the current regime based on active markets (e.g. SPY or AAPL)
    // For general indicator we can pass a dummy/neutral state or check latest index
    const dummyIndicators = {
      rsi14: 55,
      sma20: 100,
      sma50: 98,
      sma200: 95,
      ema12: 101,
      ema26: 100,
      bollingerUpper: 105,
      bollingerMiddle: 100,
      bollingerLower: 95,
      atr14: 2,
    };
    const currentClass = detectRegime(dummyIndicators as any, 100);

    return NextResponse.json({
      regimes: reportList,
      currentRegime: {
        regime: currentClass.regime,
        label: getRegimeLabel(currentClass.regime),
        confidence: currentClass.confidence
      }
    });
  } catch (err: any) {
    console.error('Failed to compute regime stats:', err);
    return NextResponse.json({ error: err.message || 'Failed to compute regime statistics.' }, { status: 500 });
  }
}
