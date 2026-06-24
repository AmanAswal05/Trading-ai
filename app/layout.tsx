import type { Metadata } from 'next';
import { ThemeProvider } from '@/lib/theme-context';
import { CurrencyProvider } from '@/lib/currency-context';
import Navbar from '@/components/ui/Navbar';
import PageCover from '@/components/ui/PageCover';
import ContextualHelp from '@/components/ui/ContextualHelp';
import SmoothScroll from '@/components/ui/SmoothScroll';
import Preloader from '@/components/ui/Preloader';
import './globals.css';

// System fallback font configurations for build stability in offline environments
const inter = {
  variable: 'font-inter',
};

const jetbrainsMono = {
  variable: 'font-jetbrains-mono',
};

export const metadata: Metadata = {
  title: 'StockPredict AI — Price Analysis & Predictions',
  description: 'Search global stock tickers, view daily candlestick charts, and receive AI-generated forecasts with indicator signal breakdowns.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} data-theme="light" suppressHydrationWarning>
      <head />
      <body className="font-sans antialiased min-h-screen flex flex-col transition-colors duration-200" suppressHydrationWarning>
        <ThemeProvider>
          <CurrencyProvider>
            <Preloader />
            <SmoothScroll>
              <PageCover />
              <Navbar />
              <main className="flex-grow">
                {children}
              </main>
              <ContextualHelp />
            </SmoothScroll>
          </CurrencyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
