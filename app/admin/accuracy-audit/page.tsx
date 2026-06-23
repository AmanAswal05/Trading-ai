'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function AccuracyAuditPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/accuracy-audit');
      if (!res.ok) throw new Error('Failed to fetch accuracy audit data');
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

  const renderBadge = (status: string) => {
    if (status === 'PASS') return <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded text-sm font-bold flex items-center gap-1 w-fit"><CheckCircle2 className="w-4 h-4" /> PASS</span>;
    if (status === 'WARNING') return <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded text-sm font-bold flex items-center gap-1 w-fit"><AlertTriangle className="w-4 h-4" /> WARNING</span>;
    return <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-sm font-bold flex items-center gap-1 w-fit"><XCircle className="w-4 h-4" /> FAIL</span>;
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
              <h1 className="text-2xl font-bold tracking-tight">Accuracy Audit & Overfitting Checks</h1>
              <p className="text-sm text-text-secondary mt-1">Strict validation of prediction claims, data integrity, and leakage prevention.</p>
            </div>
          </div>
          <button 
            onClick={fetchReport}
            className="flex items-center gap-2 bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue px-4 py-2 rounded-lg border border-accent-blue/20 transition-all font-semibold"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Run Audit
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex gap-3 text-red-400">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading && !report ? (
          <div className="h-64 flex items-center justify-center border border-border-custom rounded-xl bg-bg-secondary/50">
            <LoadingSpinner size="lg" />
          </div>
        ) : report ? (
          <div className="space-y-6">
            
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-bg-card border border-border-custom rounded-lg p-4">
                <p className="text-xs text-text-secondary uppercase font-semibold">Total Verified</p>
                <p className="text-2xl font-bold mt-1">{report.totalVerified}</p>
              </div>
              <div className="bg-bg-card border border-border-custom rounded-lg p-4">
                <p className="text-xs text-text-secondary uppercase font-semibold">Overall Accuracy</p>
                <p className="text-2xl font-bold mt-1 text-accent-blue">{report.overallAccuracy}%</p>
              </div>
              <div className="bg-bg-card border border-border-custom rounded-lg p-4">
                <p className="text-xs text-text-secondary uppercase font-semibold">Tradeable Accuracy</p>
                <p className="text-2xl font-bold mt-1 text-premium-gold">{report.tradeableAccuracy}%</p>
              </div>
              <div className="bg-bg-card border border-border-custom rounded-lg p-4">
                <p className="text-xs text-text-secondary uppercase font-semibold">Mock Exclusions</p>
                <p className="text-2xl font-bold mt-1 text-red-400">{report.mockExclusionCount}</p>
              </div>
            </div>

            {/* Calibration Stats */}
            <div className="bg-bg-card border border-border-custom rounded-xl p-5 shadow-lg">
              <h3 className="font-bold text-lg mb-4">Calibration Health Metrics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-text-secondary">Avg Confidence (Correct)</p>
                  <p className="text-xl font-mono mt-1 text-green-400">{report.averageConfidenceCorrect}%</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Avg Confidence (Incorrect)</p>
                  <p className="text-xl font-mono mt-1 text-red-400">{report.averageConfidenceIncorrect}%</p>
                </div>
                <div>
                  <p className="text-sm text-text-secondary">High Confidence Error (ECE)</p>
                  <p className="text-xl font-mono mt-1 text-yellow-400">{report.calibrationError}% gap</p>
                </div>
              </div>
            </div>

            {/* Badges and Failures Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-bg-card border border-border-custom rounded-xl overflow-hidden shadow-lg">
                <div className="bg-bg-secondary p-4 border-b border-border-custom">
                  <h3 className="font-bold">Audit Badges</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary font-medium">Data Integrity</span>
                    {renderBadge(report.badges.dataIntegrity)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary font-medium">No Future Leakage</span>
                    {renderBadge(report.badges.noLeakage)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary font-medium">Calibration Health</span>
                    {renderBadge(report.badges.calibrationHealth)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary font-medium">Sample Size Health</span>
                    {renderBadge(report.badges.sampleSizeHealth)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary font-medium">Overfitting Risk</span>
                    {renderBadge(report.badges.overfittingRisk)}
                  </div>
                </div>
              </div>

              <div className="bg-bg-card border border-border-custom rounded-xl overflow-hidden shadow-lg flex flex-col">
                <div className="bg-bg-secondary p-4 border-b border-border-custom">
                  <h3 className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /> Failure Reasons & Warnings</h3>
                </div>
                <div className="p-4 flex-1">
                  {report.failureReasons.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-green-400 opacity-80 py-8">
                      <CheckCircle2 className="w-12 h-12 mb-3 opacity-50" />
                      <p className="font-medium text-center">System is completely healthy.<br/>No leakage or overfitting detected.</p>
                    </div>
                  ) : (
                    <ul className="list-disc pl-5 space-y-2 text-sm">
                      {report.failureReasons.map((reason: string, idx: number) => (
                        <li key={idx} className={reason.toLowerCase().includes('fail') || reason.toLowerCase().includes('critically') || reason.toLowerCase().includes('leakage') ? 'text-red-400' : 'text-yellow-400'}>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

          </div>
        ) : null}
      </div>
    </div>
  );
}
