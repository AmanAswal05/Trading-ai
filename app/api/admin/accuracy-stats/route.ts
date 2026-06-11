import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { PredictionsDbService } from '@/lib/predictions-db';

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
    console.error('Accuracy-stats route auth error:', err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);

  if (!user || !user.email || !(user.email.toLowerCase().includes('admin') || user.email.toLowerCase().endsWith('@stockpredict.ai'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const timeframe = searchParams.get('timeframe') || 'ALL'; // 7D, 30D, 90D, 365D, ALL

    const origin = request.nextUrl.origin;
    const stats = await PredictionsDbService.getVerificationStats(timeframe, origin);

    return NextResponse.json(stats);
  } catch (err: any) {
    console.error('Failed to fetch accuracy stats:', err);
    return NextResponse.json({ error: err.message || 'Failed to calculate accuracy statistics.' }, { status: 500 });
  }
}
