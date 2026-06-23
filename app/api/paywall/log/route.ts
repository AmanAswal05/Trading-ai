/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

async function getUser(request: NextRequest) {
  // Check if we have a mock user cookie in offline/mock mode
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-url')) {
    const mockUserCookie = request.cookies.get('sp_mock_user');
    if (mockUserCookie) {
      try {
        const email = decodeURIComponent(mockUserCookie.value);
        return {
          id: 'mock-user-id',
          email: email,
        };
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
    console.error('Log route auth error:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  let ticker = '';
  
  try {
    const body = await request.json();
    ticker = (body.ticker || '').toUpperCase();
  } catch (err) {
    // Ticker is optional but recommended
  }

  // 1. Authenticated User flow
  if (user) {
    // Check if user is an admin - skip tracking logs
    if (isAdminEmail(user.email)) {
      return NextResponse.json({ success: true, logged: false, mode: 'admin', reason: 'admin_bypass' });
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const { error } = await supabase
          .from('stock_searches')
          .insert({
            user_id: user.id,
            stock_symbol: ticker || 'UNKNOWN',
          });

        if (error) throw error;
      } catch (err) {
        console.error('Failed to log stock search in database:', err);
      }
      return NextResponse.json({ success: true, logged: true, mode: 'user' });
    } else {
      // Mock mode: update search count in cookie
      const mockSubCookie = request.cookies.get('sp_mock_subscription');
      let mockSub: any = null;
      if (mockSubCookie) {
        try {
          mockSub = JSON.parse(decodeURIComponent(mockSubCookie.value));
        } catch (e) {
          console.error('Failed to parse mock subscription cookie:', e);
        }
      }

      if (!mockSub) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);
        mockSub = {
          plan_name: 'Pro',
          billing_cycle: 'Trial',
          status: 'Active',
          start_date: new Date().toISOString(),
          end_date: expiryDate.toISOString(),
          trial_used: true,
          search_count: 0,
          amount: 0,
          payment_id: 'mock_trial_init'
        };
      }

      mockSub.search_count = (mockSub.search_count || 0) + 1;

      const response = NextResponse.json({ success: true, logged: true, mode: 'user_mock', count: mockSub.search_count });
      response.cookies.set('sp_mock_subscription', JSON.stringify(mockSub), {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });
      return response;
    }
  }

  // 2. Guest User flow (Unauthenticated)
  const guestSearchesCookie = request.cookies.get('sp_guest_searches');
  const currentCount = guestSearchesCookie ? parseInt(guestSearchesCookie.value, 10) : 0;
  const newCount = currentCount + 1;

  const response = NextResponse.json({
    success: true,
    logged: true,
    mode: 'guest',
    count: newCount,
  });

  // Set the guest count cookie for 1 year
  response.cookies.set('sp_guest_searches', String(newCount), {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: 'lax',
  });

  return response;
}
