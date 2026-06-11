import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();
    const headers = request.headers;
    
    let eventType = '';
    let userId = '';
    let amount = 0;
    let currency = 'INR';
    let planId = 'monthly';
    let transactionId = '';
    let provider = 'Unknown';
    let isSuccess = false;

    // Check header signature type to differentiate Stripe vs Razorpay
    const stripeSignature = headers.get('stripe-signature');
    const razorpaySignature = headers.get('x-razorpay-signature');

    if (stripeSignature) {
      provider = 'Stripe';
      const event = JSON.parse(bodyText);
      eventType = event.type;
      
      if (eventType === 'checkout.session.completed' || eventType === 'invoice.payment_succeeded') {
        const session = event.data?.object;
        userId = session?.client_reference_id || session?.metadata?.userId;
        amount = (session?.amount_total || 0) / 100; // Stripe uses cents
        currency = (session?.currency || 'inr').toUpperCase();
        planId = session?.metadata?.planId || 'monthly';
        transactionId = session?.id || session?.payment_intent;
        isSuccess = session?.payment_status === 'paid' || eventType === 'invoice.payment_succeeded';
      }
    } else if (razorpaySignature) {
      provider = 'Razorpay';
      const event = JSON.parse(bodyText);
      eventType = event.event;

      if (eventType === 'payment.captured' || eventType === 'subscription.charged') {
        const payload = event.payload?.payment?.entity;
        userId = payload?.notes?.userId || event.payload?.subscription?.entity?.notes?.userId;
        amount = (payload?.amount || 0) / 100; // Razorpay uses paise
        currency = (payload?.currency || 'INR').toUpperCase();
        planId = payload?.notes?.planId || 'monthly';
        transactionId = payload?.id;
        isSuccess = payload?.status === 'captured';
      }
    } else {
      // Mock / direct webhook endpoint simulation for developer testing
      const mockEvent = JSON.parse(bodyText);
      provider = mockEvent.provider || 'Mock';
      userId = mockEvent.userId;
      amount = mockEvent.amount || 999;
      currency = mockEvent.currency || 'INR';
      planId = mockEvent.planId || 'monthly';
      transactionId = mockEvent.transactionId || `mock_webhook_${Date.now()}`;
      isSuccess = mockEvent.status === 'Success';
    }

    if (isSuccess && userId && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      // Calculate expiry date based on plan
      const expiryDate = new Date();
      if (planId === 'weekly') expiryDate.setDate(expiryDate.getDate() + 7);
      else if (planId === 'monthly') expiryDate.setDate(expiryDate.getDate() + 30);
      else if (planId === 'yearly') expiryDate.setDate(expiryDate.getDate() + 365);

      console.log(`[Webhook] Success checkout for user ${userId}. Plan: ${planId}. Provider: ${provider}`);

      // 1. Upsert subscription record
      const { error: subError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          plan_name: 'Pro',
          billing_cycle: planId.charAt(0).toUpperCase() + planId.slice(1),
          status: 'Active',
          start_date: new Date().toISOString(),
          end_date: expiryDate.toISOString(),
          trial_used: true,
        }, { onConflict: 'user_id' });

      if (subError) {
        console.error('[Webhook] Failed to update subscription:', subError);
        throw subError;
      }

      // 2. Insert payment record
      const { error: payError } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          amount: amount,
          currency: currency,
          payment_provider: provider,
          status: 'Success',
          transaction_id: transactionId,
        });

      if (payError) {
        console.error('[Webhook] Failed to log payment:', payError);
        throw payError;
      }
    }

    return NextResponse.json({ received: true, processed: isSuccess });

  } catch (err: any) {
    console.error('[Webhook API] Processing Error:', err);
    return NextResponse.json({ error: err.message || 'Webhook processing failed.' }, { status: 500 });
  }
}
