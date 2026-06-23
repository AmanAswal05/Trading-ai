/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Mail, Lock, AlertCircle } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    const isMockMode = !isSupabaseConfigured;

    if (isMockMode) {
      console.warn('Supabase not configured. Simulating mock signup for testing.');
      document.cookie = `sp_mock_user=${encodeURIComponent(email)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
      router.push('/dashboard');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      document.cookie = 'sp_mock_user=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'sp_mock_subscription=; path=/; max-age=0; SameSite=Lax';
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-bg-primary px-4 py-12 transition-theme">
      <div className="w-full max-w-md space-y-6 p-6 border border-border-custom bg-bg-card rounded-2xl shadow-sm animate-reveal">
        
        {/* Header */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-text-primary tracking-tight">
            Create Account
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Sign up to track and forecast equity assets
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-accent-red/10 border border-accent-red/25 text-accent-red text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="leading-snug">{errorMsg}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 border border-border-custom bg-bg-secondary rounded-xl pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue transition-theme"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 border border-border-custom bg-bg-secondary rounded-xl pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue transition-theme"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 flex items-center justify-center bg-accent-blue hover:bg-opacity-90 text-white font-semibold rounded-xl text-sm transition-all-custom cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Create Account'}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center text-xs text-text-secondary pt-2 border-t border-border-custom">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-accent-blue hover:underline font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
