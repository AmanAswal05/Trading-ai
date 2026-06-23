import { NextRequest, NextResponse } from 'next/server';
import { PredictionsDbService } from '@/lib/predictions-db';
import { getAuthenticatedAdmin } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedAdmin(request);

  if (!user) {
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
