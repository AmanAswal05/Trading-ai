import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { PredictionsDbService } from '@/lib/predictions-db';
import {
  analyzeIndicatorPerformance,
  getWeightHistory,
  loadCurrentWeights
} from '@/lib/adaptive-weights';

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
