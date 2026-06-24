import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/admin-api-auth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedAdmin(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    // Delete all predictions where error_percentage is exactly 0 or 5 (our old fake mock data)
    const { data, error } = await supabase
      .from('predictions')
      .delete()
      .in('error_percentage', [0, 5]);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: 'Deleted stale mock data.' });
  } catch (err: any) {
    console.error('Failed to clear mock data:', err);
    return NextResponse.json({ error: err.message || 'Failed to clear mock data.' }, { status: 500 });
  }
}
