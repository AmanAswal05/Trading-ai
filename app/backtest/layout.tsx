import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Backtesting Lab — StockPredict AI',
  description: 'Institutional-grade backtesting framework. Stress test the prediction engine with decades of market data, Monte Carlo simulations, and walk-forward analysis.',
};

export default function BacktestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
