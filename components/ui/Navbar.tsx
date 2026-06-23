/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import ThemeToggle from './ThemeToggle';
import CurrencySelector from './CurrencySelector';
import SearchBar from '@/components/dashboard/SearchBar';
import { isAdminEmail } from '@/lib/admin-auth';
import { TrendingUp, LogOut, Search, User, X } from 'lucide-react';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const getCookie = (name: string) => {
      const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]*)'));
      return match ? decodeURIComponent(match[2]) : null;
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSessionUser(session.user);
      } else {
        const mockEmail = getCookie('sp_mock_user');
        if (mockEmail) {
          setSessionUser({ email: mockEmail, id: 'mock-user-id' });
        } else {
          setSessionUser(null);
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSessionUser(session.user);
      } else {
        const mockEmail = getCookie('sp_mock_user');
        if (mockEmail) {
          setSessionUser({ email: mockEmail, id: 'mock-user-id' });
        } else {
          setSessionUser(null);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile search on page navigation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMobileSearchOpen(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    document.cookie = 'sp_mock_user=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'sp_mock_subscription=; path=/; max-age=0; SameSite=Lax';
    setSessionUser(null);
    router.push('/');
  };

  return (
    <header className={`sticky top-0 z-40 w-full transition-all duration-300 ${
      scrolled 
        ? 'border-b border-border-custom bg-bg-card/75 backdrop-blur-md shadow-sm' 
        : 'border-b border-transparent bg-transparent'
    }`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 relative">
        {/* Mobile Search Overlay */}
        {isMobileSearchOpen && (
          <div className="absolute inset-0 bg-bg-card px-4 sm:px-6 flex items-center justify-between gap-3 z-50 animate-in fade-in duration-150">
            <button
              onClick={() => setIsMobileSearchOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-custom bg-bg-secondary hover:bg-bg-card-hover text-text-secondary hover:text-text-primary transition-all-custom cursor-pointer"
              aria-label="Close search"
            >
              <X className="w-4.5 h-4.5" />
            </button>
            <div className="flex-1">
              <SearchBar variant="small" />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-blue/15 text-accent-blue transition-colors group-hover:bg-accent-blue/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="font-sans font-bold text-lg tracking-tight text-text-primary hidden sm:block">
              StockPredict <span className="text-accent-blue">AI</span>
            </span>
          </Link>

          {/* Live/Demo Badge */}
          <span className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border tracking-wide uppercase ${
            process.env.NEXT_PUBLIC_LIVE_DATA === 'true' 
              ? 'bg-accent-green/10 text-accent-green border-accent-green/20'
              : 'bg-accent-blue/10 text-accent-blue border-accent-blue/20'
          }`}>
            {process.env.NEXT_PUBLIC_LIVE_DATA === 'true' ? 'Live Data' : 'Demo Data'}
          </span>
        </div>

        {/* Quick Search - Autocomplete Search Bar */}
        <div className="flex-1 max-w-xs mx-4 hidden md:block">
          <SearchBar variant="small" />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Mobile Search Button */}
          <button
            onClick={() => setIsMobileSearchOpen(true)}
            className="flex h-10 w-10 md:hidden items-center justify-center rounded-xl border border-border-custom bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary cursor-pointer transition-theme"
            title="Search Market"
            aria-label="Search market"
          >
            <Search className="w-4.5 h-4.5" />
          </button>

          <Link
            href="/trust"
            className="flex items-center justify-center h-10 px-3.5 rounded-xl border border-border-custom bg-bg-card hover:bg-bg-card-hover text-xs font-semibold text-text-secondary hover:text-text-primary transition-theme"
            title="Public Verification & Trust Statistics"
          >
            Verified Accuracy
          </Link>
          <CurrencySelector />
          <ThemeToggle />

          {sessionUser ? (
            <div className="flex items-center gap-2">
              {isAdminEmail(sessionUser.email) && (
                <Link
                  href="/admin"
                  className="flex items-center justify-center h-10 px-4 rounded-xl border border-accent-blue/30 bg-accent-blue/10 hover:bg-accent-blue/15 text-sm font-semibold text-accent-blue transition-theme"
                >
                  Admin Console
                </Link>
              )}
              <Link
                href="/dashboard"
                className="flex items-center justify-center h-10 px-4 rounded-xl border border-border-custom bg-bg-secondary text-sm font-medium hover:bg-bg-card-hover text-text-primary transition-theme"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-custom bg-bg-card hover:bg-bg-card-hover text-accent-red hover:bg-accent-red/5 cursor-pointer transition-theme"
                title="Log Out"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="flex h-10 items-center justify-center px-4 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary nav-link-premium transition-theme mr-2"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="flex h-10 items-center justify-center px-4 rounded-xl bg-accent-blue text-sm font-medium text-white hover:bg-opacity-90 transition-theme"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
