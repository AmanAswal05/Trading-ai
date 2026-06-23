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
    console.error('Check route auth error:', err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  
  // 1. Authenticated User Flow
  if (user) {
    // Check if user is an admin
    if (isAdminEmail(user.email)) {
      return NextResponse.json({
        allowed: true,
        plan: 'Admin',
        reason: 'admin_unlimited_access',
      });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      // Offline/Mock mode for registered users (using cookies for state simulation)
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
        // Automatically initialize default trial if none exists
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

      const isProActive = mockSub.plan_name === 'Pro' && 
                          mockSub.status === 'Active' && 
                          mockSub.billing_cycle !== 'Trial' && 
                          new Date(mockSub.end_date) > new Date();

      const isTrialActive = mockSub.plan_name === 'Pro' && 
                            mockSub.status === 'Active' && 
                            mockSub.billing_cycle === 'Trial' && 
                            new Date(mockSub.end_date) > new Date();

      // Set cookie back in response if it's new
      const responseJson: any = {
        trialUsed: mockSub.trial_used || false,
      };

      if (isProActive) {
        responseJson.allowed = true;
        responseJson.plan = 'Pro';
        responseJson.billingCycle = mockSub.billing_cycle;
        responseJson.reason = 'active_subscription';
      } else if (isTrialActive) {
        const diffMs = new Date(mockSub.end_date).getTime() - Date.now();
        const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        responseJson.allowed = true;
        responseJson.plan = 'Pro';
        responseJson.billingCycle = 'Trial';
        responseJson.trialDaysLeft = daysLeft;
        responseJson.reason = 'active_trial';
      } else {
        // Free user search count check
        const searchesLeft = 2 - (mockSub.search_count || 0);
        if (searchesLeft > 0) {
          responseJson.allowed = true;
          responseJson.plan = 'Free';
          responseJson.searchCount = mockSub.search_count || 0;
          responseJson.reason = 'free_searches_remaining';
        } else {
          responseJson.allowed = false;
          responseJson.plan = 'Free';
          responseJson.searchCount = mockSub.search_count || 0;
          responseJson.reason = mockSub.billing_cycle === 'Trial' ? 'trial_expired' : 'limit_reached';
        }
      }

      const res = NextResponse.json(responseJson);
      if (!mockSubCookie) {
        res.cookies.set('sp_mock_subscription', JSON.stringify(mockSub), {
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
          sameSite: 'lax',
        });
      }
      return res;
    }

    try {
      // Fetch subscription from Supabase
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!subscription) {
        // Fallback: Create a default trial subscription if it doesn't exist
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);

        const { data: newSub, error: createError } = await supabase
          .from('subscriptions')
          .insert({
            user_id: user.id,
            plan_name: 'Pro',
            billing_cycle: 'Trial',
            status: 'Active',
            start_date: new Date().toISOString(),
            end_date: expiryDate.toISOString(),
            trial_used: true,
            amount: 0,
            payment_id: 'trial_setup'
          })
          .select()
          .single();

        if (createError) throw createError;

        return NextResponse.json({
          allowed: true,
          plan: 'Pro',
          billingCycle: 'Trial',
          trialDaysLeft: 7,
          trialUsed: true,
          reason: 'new_trial_created',
        });
      }

      const isProActive = subscription.plan_name === 'Pro' && 
                          subscription.status === 'Active' && 
                          subscription.billing_cycle !== 'Trial' && 
                          new Date(subscription.end_date) > new Date();

      const isTrialActive = subscription.plan_name === 'Pro' && 
                            subscription.status === 'Active' && 
                            subscription.billing_cycle === 'Trial' && 
                            new Date(subscription.end_date) > new Date();

      const trialUsed = subscription.trial_used || false;

      if (isProActive) {
        return NextResponse.json({
          allowed: true,
          plan: 'Pro',
          billingCycle: subscription.billing_cycle,
          trialUsed,
          reason: 'active_subscription',
        });
      }

      if (isTrialActive) {
        const diffMs = new Date(subscription.end_date).getTime() - Date.now();
        const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        return NextResponse.json({
          allowed: true,
          plan: 'Pro',
          billingCycle: 'Trial',
          trialDaysLeft: daysLeft,
          trialUsed,
          reason: 'active_trial',
        });
      }

      // Free user: count queries in stock_searches
      const { count: searchCount, error: countError } = await supabase
        .from('stock_searches')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) throw countError;

      const currentCount = searchCount || 0;
      if (currentCount < 2) {
        return NextResponse.json({
          allowed: true,
          plan: 'Free',
          trialUsed,
          searchCount: currentCount,
          reason: 'free_searches_remaining',
        });
      }

      // Expired trial or inactive subscriptions are blocked
      return NextResponse.json({
        allowed: false,
        plan: 'Free',
        trialUsed,
        searchCount: currentCount,
        reason: subscription.billing_cycle === 'Trial' ? 'trial_expired' : 'limit_reached',
      });

    } catch (err: any) {
      console.error('Supabase subscription check error:', err);
      return NextResponse.json({
        allowed: true,
        plan: 'Free',
        trialUsed: true,
        searchCount: 0,
        reason: 'db_fallback_allowed',
      });
    }
  }

  // 2. Guest User Flow (Unauthenticated)
  const guestSearchesCookie = request.cookies.get('sp_guest_searches');
  const searchCount = guestSearchesCookie ? parseInt(guestSearchesCookie.value, 10) : 0;

  if (searchCount >= 2) {
    return NextResponse.json({
      allowed: false,
      plan: 'Guest',
      reason: 'guest_limit',
      searchCount,
    });
  }

  return NextResponse.json({
    allowed: true,
    plan: 'Guest',
    reason: 'guest_below_limit',
    searchCount,
  });
}
