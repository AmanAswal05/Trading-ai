'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertTriangle, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function FeaturePerformancePage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/feature-performance');
      if (!res.ok) throw new Error('Failed to fetch feature performance data');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'BOOSTED':
        return <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 w-fit"><ChevronUp className="w-3 h-3" /> Boosted</span>;
      case 'PENALIZED':
        return <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 w-fit"><ChevronDown className="w-3 h-3" /> Penalized</span>;
      case 'NEUTRAL':
        return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> Verified</span>;
      case 'LEARNING':
      default:
        return <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 w-fit"><AlertTriangle className="w-3 h-3" /> Learning</span>;
    }
  };

  const getAccuracyColor = (accuracy: number, sampleSize: number) => {
    if (sampleSize < 20) return 'text-text-secondary';
    if (accuracy >= 60) return 'text-green-400 font-bold';
    if (accuracy < 45) return 'text-red-400 font-bold';
    return 'text-text-primary';
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-custom pb-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 bg-bg-secondary hover:bg-bg-card border border-border-custom rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Feature Performance Engine</h1>
              <p className="text-sm text-text-secondary mt-1">Autonomous learning and dynamic weight adjustments for algorithmic features.</p>
            </div>
          </div>
          <button 
            onClick={fetchReport}
            className="flex items-center gap-2 bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue px-4 py-2 rounded-lg border border-accent-blue/20 transition-all font-semibold"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3 text-red-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading && !report ? (
          <div className="h-64 flex items-center justify-center border border-border-custom rounded-xl bg-bg-secondary/50">
            <LoadingSpinner size="lg" />
          </div>
        ) : report ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-bg-card border border-border-custom rounded-lg p-4">
              <div className="flex gap-8">
                <div>
                  <p className="text-xs text-text-secondary uppercase tracking-wider font-semibold">Total Features Evaluated</p>
                  <p className="text-xl font-bold mt-1">{Object.keys(report.features).length}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary uppercase tracking-wider font-semibold">Last Processed</p>
                  <p className="text-xl font-bold mt-1 text-premium-gold">{new Date(report.lastUpdated).toLocaleTimeString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-bg-card border border-border-custom rounded-xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-secondary border-b border-border-custom">
                      <th className="p-4 font-semibold text-text-secondary text-sm">Feature Name</th>
                      <th className="p-4 font-semibold text-text-secondary text-sm">Activation Logic</th>
                      <th className="p-4 font-semibold text-text-secondary text-sm">Verified Samples</th>
                      <th className="p-4 font-semibold text-text-secondary text-sm">Win/Loss Ratio</th>
                      <th className="p-4 font-semibold text-text-secondary text-sm">True Accuracy</th>
                      <th className="p-4 font-semibold text-text-secondary text-sm">Weight Engine Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(report.features).map((feat: any, idx: number) => (
                      <tr key={feat.featureName} className={`border-b border-border-custom/50 hover:bg-bg-secondary/40 transition-colors ${idx % 2 === 0 ? 'bg-bg-primary/20' : ''}`}>
                        <td className="p-4">
                          <span className="font-mono text-sm text-accent-blue">{feat.featureName}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-xs text-text-secondary font-mono bg-bg-primary px-2 py-1 rounded border border-border-custom/50">{feat.condition}</span>
                        </td>
                        <td className="p-4 font-medium">{feat.sampleSize}</td>
                        <td className="p-4 font-medium">{feat.winCount} / {feat.lossCount}</td>
                        <td className="p-4">
                          <span className={`text-lg tracking-tight ${getAccuracyColor(feat.directionalAccuracy, feat.sampleSize)}`}>
                            {feat.sampleSize > 0 ? `${feat.directionalAccuracy}%` : '--'}
                          </span>
                        </td>
                        <td className="p-4">
                          {renderStatusBadge(feat.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="bg-bg-secondary/40 border border-border-custom rounded-lg p-5">
              <h3 className="font-bold mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-accent-blue" /> How Learning Works</h3>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-2">
                <li>Features start in <strong className="text-yellow-400 font-medium">LEARNING</strong> mode until they gather at least <strong>20 verified predictions</strong>. During this phase, standard heuristic weights apply.</li>
                <li>Once 20 samples are collected, the engine evaluates real-world accuracy. If a feature hits <strong className="text-green-400 font-medium">&gt;60% accuracy</strong>, it becomes <strong className="text-green-400 font-medium">BOOSTED</strong> (+50% weight).</li>
                <li>If a feature drops <strong className="text-red-400 font-medium">&lt;45% accuracy</strong>, it becomes <strong className="text-red-400 font-medium">PENALIZED</strong> (-80% weight), removing false signals.</li>
                <li>This ensures the AI continuously adapts to shifting market conditions and discards indicators that no longer work.</li>
              </ul>
            </div>
            
          </div>
        ) : null}
      </div>
    </div>
  );
}
