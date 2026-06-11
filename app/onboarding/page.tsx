'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme-context';
import { useCurrency } from '@/lib/currency-context';
import { supabase } from '@/lib/supabase';
import { CurrencyCode } from '@/types/stock';
import { BrainCircuit, Sun, Moon, Laptop, Globe, ArrowRight, Check } from 'lucide-react';

type Step = 'welcome' | 'theme' | 'currency' | 'profile';

export default function OnboardingPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { currency, setCurrency } = useCurrency();
  
  const [step, setStep] = useState<Step>('welcome');
  
  // Settings selections
  const [selectedTheme, setSelectedTheme] = useState<'Light Mode' | 'Dark Mode' | 'Follow System'>('Follow System');
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>('INR');
  
  // Profile questionnaire
  const [experience, setExperience] = useState('Intermediate');
  const [market, setMarket] = useState('IN');
  const [horizon, setHorizon] = useState('Medium');
  
  const [saving, setSaving] = useState(false);

  const handleThemeSelect = (themeType: 'Light Mode' | 'Dark Mode' | 'Follow System') => {
    setSelectedTheme(themeType);
    
    // Dynamically apply visual theme so they see the impact immediately
    const root = window.document.documentElement;
    if (themeType === 'Light Mode') {
      root.setAttribute('data-theme', 'light');
    } else if (themeType === 'Dark Mode') {
      root.setAttribute('data-theme', 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  };

  const handleCurrencySelect = (code: CurrencyCode) => {
    setSelectedCurrency(code);
    setCurrency(code); // update context instantly
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (userId && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        // 1. Save preferences to users table
        await supabase
          .from('users')
          .update({
            theme_preference: selectedTheme,
            currency_preference: selectedCurrency,
          })
          .eq('id', userId);

        // 2. Insert into profiles (experience level, horizon)
        await supabase.from('profiles').upsert({
          user_id: userId,
          experience_level: experience,
          preferred_market: market,
          investment_horizon: horizon,
        });

        // 3. Setup default subscription as Free
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7); // 7-day trial default

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          plan_name: 'Free',
          billing_cycle: 'None',
          status: 'Active',
          start_date: new Date().toISOString(),
          end_date: expiryDate.toISOString(),
          trial_used: true,
        });

        // 4. Save settings
        await supabase.from('settings').upsert({
          user_id: userId,
          theme: selectedTheme,
          currency: selectedCurrency,
          notifications: true,
        });
      } else {
        // Fallback for guest or mock user mode
        console.warn('Supabase not configured. Saving settings in localStorage.');
        localStorage.setItem('sp_onboarding_completed', 'true');
        localStorage.setItem('sp_experience', experience);
        localStorage.setItem('sp_market', market);
        localStorage.setItem('sp_horizon', horizon);
      }
      
      router.push('/dashboard');
    } catch (err) {
      console.error('Failed to save onboarding settings:', err);
      router.push('/dashboard'); // route anyway on error to avoid blocking the user
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-bg-primary px-4 py-12 transition-theme">
      <div className="w-full max-w-xl p-8 border border-border-custom bg-bg-card rounded-2xl shadow-sm transition-theme flex flex-col gap-6">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-border-custom pb-4.5">
          <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
            Onboarding Flow
          </span>
          <div className="flex gap-1.5">
            {(['welcome', 'theme', 'currency', 'profile'] as const).map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === s ? 'w-6 bg-accent-primary' : 'w-2.5 bg-bg-secondary'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Content */}
        {step === 'welcome' && (
          <div className="text-center py-6 space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-primary">
              <BrainCircuit className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                Welcome to StockPredict AI Pro
              </h1>
              <p className="text-sm text-text-secondary leading-relaxed max-w-sm mx-auto">
                Your institutional intelligence terminal for forecasting price probabilities, checking statistical wicks, and tracking portfolios.
              </p>
            </div>
            <button
              onClick={() => setStep('theme')}
              className="mt-4 flex items-center justify-center gap-2 px-6 h-12 bg-accent-primary text-white font-semibold rounded-xl text-sm hover:bg-opacity-90 cursor-pointer shadow-sm mx-auto transition-theme"
            >
              Configure Setup
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'theme' && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-text-primary">Preferred Terminal Theme</h2>
              <p className="text-xs text-text-secondary">Choose a dashboard appearance to suit your environment</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(
                [
                  { type: 'Light Mode', icon: Sun, desc: 'Soft warm beige' },
                  { type: 'Dark Mode', icon: Moon, desc: 'Calm charcoal black' },
                  { type: 'Follow System', icon: Laptop, desc: 'Auto system match' },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                const isSelected = selectedTheme === t.type;
                return (
                  <button
                    key={t.type}
                    onClick={() => handleThemeSelect(t.type)}
                    className={`flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer text-center transition-all ${
                      isSelected
                        ? 'border-accent-primary bg-accent-soft/20 text-accent-primary'
                        : 'border-border-custom bg-bg-secondary/40 text-text-secondary hover:bg-bg-card-hover'
                    }`}
                  >
                    <Icon className="w-6 h-6 mb-2.5" />
                    <span className="text-xs font-bold font-sans">{t.type}</span>
                    <span className="text-[10px] text-text-muted mt-1 leading-none">{t.desc}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStep('currency')}
              className="w-full flex items-center justify-center gap-2 h-12 bg-accent-primary text-white font-semibold rounded-xl text-sm hover:bg-opacity-90 cursor-pointer shadow-sm transition-theme"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'currency' && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-text-primary">Currency Format</h2>
              <p className="text-xs text-text-secondary">Select your preferred format for pricing conversion indexes</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  { code: 'INR', label: 'Indian Rupee (₹)', symbol: '₹' },
                  { code: 'USD', label: 'US Dollar ($)', symbol: '$' },
                  { code: 'EUR', label: 'Euro (€)', symbol: '€' },
                  { code: 'GBP', label: 'British Pound (£)', symbol: '£' },
                  { code: 'JPY', label: 'Japanese Yen (¥)', symbol: '¥' },
                ] as const
              ).map((c) => {
                const isSelected = selectedCurrency === c.code;
                return (
                  <button
                    key={c.code}
                    onClick={() => handleCurrencySelect(c.code)}
                    className={`flex items-center justify-between p-3.5 border rounded-xl cursor-pointer text-left transition-all ${
                      isSelected
                        ? 'border-accent-primary bg-accent-soft/20 text-accent-primary'
                        : 'border-border-custom bg-bg-secondary/40 text-text-secondary hover:bg-bg-card-hover'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">{c.symbol}</span>
                      <span className="text-xs font-semibold">{c.label}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-accent-primary" />}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStep('profile')}
              className="w-full flex items-center justify-center gap-2 h-12 bg-accent-primary text-white font-semibold rounded-xl text-sm hover:bg-opacity-90 cursor-pointer shadow-sm transition-theme"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'profile' && (
          <div className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-text-primary">Investor Profile Questionnaire</h2>
              <p className="text-xs text-text-secondary">Help us tailor your terminal parameters and signals</p>
            </div>

            <div className="space-y-4">
              {/* Experience */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Experience Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Beginner', 'Intermediate', 'Advanced'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setExperience(lvl)}
                      className={`h-10 text-xs font-semibold rounded-xl border cursor-pointer transition-all ${
                        experience === lvl
                          ? 'border-accent-primary bg-accent-soft/15 text-accent-primary'
                          : 'border-border-custom bg-bg-secondary/35 text-text-secondary hover:bg-bg-card-hover'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Market */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Preferred Trading Market
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { code: 'IN', label: 'India (NSE/BSE)' },
                    { code: 'US', label: 'United States' },
                    { code: 'EU', label: 'Europe' },
                  ].map((mkt) => (
                    <button
                      key={mkt.code}
                      type="button"
                      onClick={() => setMarket(mkt.code)}
                      className={`h-10 text-xs font-semibold rounded-xl border cursor-pointer transition-all ${
                        market === mkt.code
                          ? 'border-accent-primary bg-accent-soft/15 text-accent-primary'
                          : 'border-border-custom bg-bg-secondary/35 text-text-secondary hover:bg-bg-card-hover'
                      }`}
                    >
                      {mkt.code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Horizon */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Investment Horizon
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Short', 'Medium', 'Long'].map((hor) => (
                    <button
                      key={hor}
                      type="button"
                      onClick={() => setHorizon(hor)}
                      className={`h-10 text-xs font-semibold rounded-xl border cursor-pointer transition-all ${
                        horizon === hor
                          ? 'border-accent-primary bg-accent-soft/15 text-accent-primary'
                          : 'border-border-custom bg-bg-secondary/35 text-text-secondary hover:bg-bg-card-hover'
                      }`}
                    >
                      {hor}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleComplete}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 h-12 bg-accent-primary text-white font-semibold rounded-xl text-sm hover:bg-opacity-90 cursor-pointer shadow-sm transition-theme disabled:opacity-50"
            >
              {saving ? 'Saving Profile...' : 'Activate Free Trial & Enter Terminal'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
