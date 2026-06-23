'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

interface WalkForwardMetric {
  ticker: string;
  timeframe: string;
  regime: string;
  confidenceBucket: string;
  accuracy: number;
  sharpe: number;
  trades: number;
  updatedAt: string;
}

export default function WalkForwardDashboard() {
  const [metrics, setMetrics] = useState<WalkForwardMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/walk-forward/stats')
      .then((res) => res.json())
      .then((data) => {
        setMetrics(data.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-10 text-center text-text-muted">
        <div className="animate-spin w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full mx-auto mb-4"></div>
        Loading Walk-Forward metrics...
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="p-10 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary">Walk-Forward Accuracy</h1>
        <p className="text-text-secondary mt-1">Historical accuracy is measured via walk-forward testing to prevent future leakage.</p>
        <div className="mt-6 flex flex-col items-center justify-center p-12 bg-bg-card border border-border-custom rounded-xl shadow-sm text-center">
          <AlertTriangle className="w-12 h-12 text-text-muted mb-4 opacity-50" />
          <h2 className="text-lg font-medium text-text-primary">Not enough validated history</h2>
          <p className="mt-2 text-text-secondary max-w-md">The prediction engine has not accumulated enough walk-forward test folds to display statistical confidence metrics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary mb-1">Walk-Forward Accuracy</h1>
        <p className="text-text-secondary">True model performance evaluated on strictly unseen out-of-sample data windows.</p>
      </div>

      <div className="bg-bg-card border border-border-custom rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-secondary/50 border-b border-border-custom text-text-secondary font-mono text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Ticker</th>
                <th className="px-6 py-4 font-semibold">Timeframe</th>
                <th className="px-6 py-4 font-semibold">Regime</th>
                <th className="px-6 py-4 font-semibold">Confidence Bucket</th>
                <th className="px-6 py-4 font-semibold">Trades</th>
                <th className="px-6 py-4 font-semibold">Accuracy</th>
                <th className="px-6 py-4 font-semibold">Sharpe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-custom">
              {metrics.map((m, i) => (
                <tr key={i} className="hover:bg-bg-secondary/30 transition-colors">
                  <td className="px-6 py-4 font-bold text-text-primary">{m.ticker}</td>
                  <td className="px-6 py-4">
                    <span className="bg-bg-secondary text-text-secondary border border-border-custom px-2.5 py-1 rounded-md text-xs font-medium">
                      {m.timeframe}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${m.regime.includes('BULL') ? 'bg-accent-green/10 text-accent-green border border-accent-green/20' : m.regime.includes('BEAR') ? 'bg-accent-red/10 text-accent-red border border-accent-red/20' : 'bg-bg-secondary text-text-secondary border border-border-custom'}`}>
                      {m.regime}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm">{m.confidenceBucket}%</td>
                  <td className="px-6 py-4">{m.trades}</td>
                  <td className="px-6 py-4">
                    <span className={`font-bold ${m.accuracy >= 65 ? 'text-accent-green' : m.accuracy < 50 ? 'text-accent-red' : 'text-text-primary'}`}>
                      {m.accuracy.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-bold ${m.sharpe > 1 ? 'text-accent-green' : m.sharpe < 0 ? 'text-accent-red' : 'text-text-primary'}`}>
                      {m.sharpe.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
