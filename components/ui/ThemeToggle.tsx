'use client';

import { useTheme } from '@/lib/theme-context';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-xl border border-border-custom bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary transition-all-custom cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-blue"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 transition-transform duration-300 hover:rotate-12" />
      ) : (
        <Sun className="w-5 h-5 transition-transform duration-300 hover:rotate-45" />
      )}
    </button>
  );
}
