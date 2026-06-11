import type { Metadata } from 'next';
import { ThemeProvider } from '@/lib/theme-context';
import { CurrencyProvider } from '@/lib/currency-context';
import Navbar from '@/components/ui/Navbar';
import PageCover from '@/components/ui/PageCover';
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('sp_theme');
                  var theme = 'light';
                  if (stored) {
                    theme = stored;
                  } else {
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    theme = prefersDark ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', theme);
                  document.documentElement.style.colorScheme = theme;
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased min-h-screen flex flex-col transition-colors duration-200">
        <ThemeProvider>
          <CurrencyProvider>
            <PageCover />
            <Navbar />
            <main className="flex-grow">
              {children}
            </main>
          </CurrencyProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
