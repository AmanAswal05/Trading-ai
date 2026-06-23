import React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';

export default function AdminAccessDenied() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-bg-primary px-4 py-12 transition-theme">
      <div className="w-full max-w-md space-y-6 p-8 border border-border-custom bg-bg-card rounded-2xl shadow-lg text-center flex flex-col items-center">
        <div className="h-14 w-14 rounded-2xl bg-accent-red/10 text-accent-red border border-accent-red/25 flex items-center justify-center mb-2 animate-bounce">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-text-primary tracking-tight">
            Access Denied
          </h2>
          <p className="text-xs text-text-secondary leading-relaxed max-w-sm">
            Administrator privileges are required to view the institutional console and backtest machine learning hyperparameter configurations.
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full pt-4">
          <Link
            href="/auth/login"
            className="w-full h-11 flex items-center justify-center bg-accent-blue text-white hover:bg-opacity-90 font-semibold rounded-xl text-sm transition-all cursor-pointer"
          >
            Sign In with Admin Account
          </Link>
          <Link
            href="/dashboard"
            className="w-full h-11 flex items-center justify-center border border-border-custom bg-bg-secondary hover:bg-bg-card-hover text-text-primary font-semibold rounded-xl text-sm transition-all cursor-pointer"
          >
            Back to Terminal
          </Link>
        </div>
      </div>
    </div>
  );
}
