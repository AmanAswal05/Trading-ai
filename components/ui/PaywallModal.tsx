'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrency } from '@/lib/currency-context';
import { useTheme } from '@/lib/theme-context';
import { X, Check, ShieldAlert, Sparkles, Zap, Lock, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PaywallModalProps {
  isOpen: boolean;
  onClose?: () => void;
  reason: 'limit_reached' | 'trial_expired' | 'guest_limit';
}

export default function PaywallModal({ isOpen, onClose, reason }: PaywallModalProps) {
  const router = useRouter();
  const { formatPrice, currency } = useCurrency();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Plan pricing configurations in USD base (will convert using formatPrice)
  const plans = [
    {
      id: 'weekly',
      name: 'Weekly Pro',
      price: 8.38,
      period: 'week',
      description: 'Perfect for short-term active trading weeks',
      popular: false,
    },
    {
      id: 'monthly',
      name: 'Monthly Pro',
      price: 11.98,
      period: 'month',
      description: 'Our most balanced professional option',
      popular: true,
    },
    {
      id: 'yearly',
      name: 'Yearly Pro',
      price: 71.91,
      period: 'year',
      description: 'Maximum value for institutional intelligence',
      popular: false,
      discount: 'Save 50% vs Monthly',
    },
  ];

  const features = [
    'Unlimited AI-Generated Predictions (UP/DOWN/NEUTRAL)',
    'Institutional Bull / Base / Bear target price wicks',
    'Advanced Indicator overlays (RSI, MACD, Bollinger Bands)',
    'Real-time automated signals & News Sentiment Analysis',
    'Interactive Multi-asset Portfolio tracker',
    'Unlimited watchlist indicators & historical pattern scans',
  ];

  const handleCheckout = async (planId: string, amount: number) => {
    setLoadingPlan(planId);
    setErrorMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (reason === 'guest_limit' && !user) {
        // Guest user must register first
        router.push('/auth/signup');
        return;
      }

      // Call checkout session generator API
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          amount,
          currency: 'INR',
          userId: user?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize checkout session.');
      }

      // If mock checkout session is returned (fallback mode)
      if (data.isMock) {
        console.warn('Mock payment mode activated.');
        // Simulate database subscription update directly on mock mode
        if (user?.id) {
          const expiryDate = new Date();
          if (planId === 'weekly') expiryDate.setDate(expiryDate.getDate() + 7);
          else if (planId === 'monthly') expiryDate.setDate(expiryDate.getDate() + 30);
          else if (planId === 'yearly') expiryDate.setDate(expiryDate.getDate() + 365);

          await supabase.from('subscriptions').upsert({
            user_id: user.id,
            plan_name: 'Pro',
            billing_cycle: planId.charAt(0).toUpperCase() + planId.slice(1),
            status: 'Active',
            start_date: new Date().toISOString(),
            end_date: expiryDate.toISOString(),
            trial_used: true,
          });

          // Log payment success record
          await supabase.from('payments').insert({
            user_id: user.id,
            amount: amount,
            currency: 'INR',
            payment_provider: 'MockGateway',
            status: 'Success',
            transaction_id: `mock_tx_${Date.now()}`,
          });
        } else {
          // LocalStorage fallback for completely unauthenticated guests
          localStorage.setItem('sp_pro_status', 'true');
          localStorage.setItem('sp_search_count', '0');
        }

        // Reload page or redirect
        window.location.reload();
        return;
      }

      // If Razorpay/Stripe checkout URL is provided
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout endpoint resolved.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Payment processor failed. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-bg-card border border-border-custom rounded-2xl shadow-lg transition-theme flex flex-col md:flex-row overflow-hidden my-8 max-h-[90vh] md:max-h-none">
        
        {/* Left Column: Feature Highlights & Value Pitch (Teal panel) */}
        <div className="w-full md:w-5/12 bg-bg-secondary p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-border-custom">
          <div className="space-y-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-premium-gold-soft text-premium-gold border border-premium-gold/15">
              {reason === 'guest_limit' ? <Lock className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-text-primary tracking-tight">
                {reason === 'guest_limit' 
                  ? 'Limit Reached' 
                  : reason === 'trial_expired' 
                  ? 'Trial Period Expired' 
                  : 'Upgrade to Pro'}
              </h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                {reason === 'guest_limit'
                  ? 'Free guest searches are capped at 2. Create a free account or upgrade to continue analyzing equities.'
                  : reason === 'trial_expired'
                  ? 'Your 7-day institutional trial has ended. Unlock unrestricted access to continue mapping markets.'
                  : 'Gain unlimited analysis tools and machine learning forecasts to refine your strategy.'}
              </p>
            </div>

            <div className="space-y-3.5 pt-4">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-text-secondary leading-normal">
                  <Check className="w-4 h-4 text-premium-gold mt-0.5 flex-shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-border-custom/50 mt-6 md:mt-0">
            <p className="text-[10px] text-text-muted leading-relaxed">
              Secure institutional checkout. Cancel anytime. All plans subject to our terms of service and probability risk disclosures.
            </p>
          </div>
        </div>

        {/* Right Column: Pricing Options Selector */}
        <div className="w-full md:w-7/12 p-6 flex flex-col justify-between">
          
          {/* Header & Close Button */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-[10px] font-mono font-bold text-accent-primary uppercase tracking-wider">
                Select Pricing Plan
              </span>
              <h3 className="text-base font-bold text-text-primary mt-0.5">
                Invest with Intelligence
              </h3>
            </div>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-accent-red/10 border border-accent-red/25 text-accent-red text-xs flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Pricing Cards */}
          <div className="space-y-3 mb-6">
            {plans.map((plan) => {
              const isPopular = plan.popular;
              return (
                <div 
                  key={plan.id} 
                  className={`relative p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all duration-300 ${
                    isPopular 
                      ? 'border-premium-gold bg-premium-gold-soft/30' 
                      : 'border-border-custom bg-bg-card hover:bg-bg-card-hover'
                  }`}
                >
                  {isPopular && (
                    <div className="absolute right-4 -top-2 px-2 py-0.5 rounded-full bg-premium-gold text-[9px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> Popular
                    </div>
                  )}

                  <div className="space-y-1 max-w-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-primary">{plan.name}</span>
                      {plan.discount && (
                        <span className="text-[9px] font-semibold text-premium-gold px-1.5 py-0.5 bg-premium-gold-soft/50 rounded-md">
                          {plan.discount}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-secondary leading-snug">{plan.description}</p>
                  </div>

                  <div className="flex items-center sm:flex-col sm:items-end justify-between border-t sm:border-t-0 border-border-custom/50 pt-2 sm:pt-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-base font-bold text-text-primary">
                        {/* Always display the plan pricing converted to active currency */}
                        {formatPrice(plan.price)}
                      </span>
                      <span className="text-[10px] text-text-muted">/{plan.period}</span>
                    </div>
                    
                    <button
                      onClick={() => handleCheckout(plan.id, plan.price)}
                      disabled={loadingPlan !== null}
                      className={`h-9 px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isPopular
                          ? 'bg-premium-gold text-white hover:bg-premium-gold/90'
                          : 'border border-border-custom text-text-primary hover:bg-bg-secondary'
                      } disabled:opacity-50`}
                    >
                      {loadingPlan === plan.id ? (
                        'Processing...'
                      ) : reason === 'guest_limit' ? (
                        <>
                          <Zap className="w-3.5 h-3.5" /> Sign Up Free
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-3.5 h-3.5" /> Subscribe
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Sign up alternative */}
          {reason === 'guest_limit' && (
            <div className="text-center py-2.5 border-t border-border-custom/50">
              <span className="text-xs text-text-secondary">
                Already registered?{' '}
                <button
                  onClick={() => router.push('/auth/login')}
                  className="text-accent-primary hover:underline font-semibold cursor-pointer"
                >
                  Sign In to Account
                </button>
              </span>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
