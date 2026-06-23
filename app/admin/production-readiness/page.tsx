'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function ProductionReadinessPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/accuracy-audit');
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const CheckItem = ({ label, passed, desc }: { label: string, passed: boolean | 'WARNING', desc?: string }) => {
    return (
      <div className={`p-4 rounded-xl border flex items-start gap-3 ${passed === true ? 'bg-green-500/10 border-green-500/30' : passed === 'WARNING' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
        {passed === true ? (
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
        ) : passed === 'WARNING' ? (
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
        ) : (
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        )}
        <div>
          <h4 className={`font-bold ${passed === true ? 'text-green-400' : passed === 'WARNING' ? 'text-yellow-400' : 'text-red-400'}`}>{label}</h4>
          {desc && <p className="text-sm text-text-secondary mt-1">{desc}</p>}
        </div>
      </div>
    );
  };

  const allPassed = report && Object.values(report.badges).every(b => b === 'PASS') && report.mockExclusionCount === 0;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-custom pb-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 bg-bg-secondary hover:bg-bg-card border border-border-custom rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-accent-blue" />
                Production Readiness Checklist
              </h1>
              <p className="text-sm text-text-secondary mt-1">Final validation gate before launching prediction systems to live users.</p>
            </div>
          </div>
          <button 
            onClick={fetchReport}
            className="flex items-center gap-2 bg-bg-secondary hover:bg-bg-card border border-border-custom px-4 py-2 rounded-lg transition-all text-sm font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="h-48 flex items-center justify-center border border-border-custom rounded-xl bg-bg-secondary/50">
            <LoadingSpinner size="md" />
          </div>
        ) : !report ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">Failed to load audit report.</div>
        ) : (
          <div className="space-y-8">
            
            <div className={`p-6 rounded-2xl border text-center ${allPassed ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              {allPassed ? (
                <>
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2" />
                  <h2 className="text-xl font-bold">System is Production Ready</h2>
                  <p className="text-sm opacity-80 mt-1">Accuracy safety mode is currently disabled.</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
                  <h2 className="text-xl font-bold">System is NOT Production Ready</h2>
                  <p className="text-sm opacity-80 mt-1">Accuracy Safety Mode is currently active. Displayed confidences are capped.</p>
                </>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-lg border-b border-border-custom pb-2">Launch Requirements</h3>
              
              <CheckItem 
                label="Mock Data Excluded" 
                passed={report.mockExclusionCount === 0 ? true : false} 
                desc={report.mockExclusionCount === 0 ? 'No fallback/mock data found in verified predictions.' : `Warning: ${report.mockExclusionCount} predictions are using mock data. Ensure live data provider (Alpha Vantage) is active.`} 
              />
              
              <CheckItem 
                label="Calibration Healthy" 
                passed={report.badges.calibrationHealth === 'PASS' ? true : report.badges.calibrationHealth === 'WARNING' ? 'WARNING' : false} 
                desc="Ensures >90% confidence buckets actually achieve high win rates, avoiding overconfidence." 
              />
              
              <CheckItem 
                label="Sample Size Acceptable" 
                passed={report.badges.sampleSizeHealth === 'PASS' ? true : report.badges.sampleSizeHealth === 'WARNING' ? 'WARNING' : false} 
                desc={`Currently ${report.validCount || report.totalVerified} verified predictions (need >100 for PASS).`} 
              />
              
              <CheckItem 
                label="Overfitting Risk Acceptable" 
                passed={report.badges.overfittingRisk === 'PASS' ? true : report.badges.overfittingRisk === 'WARNING' ? 'WARNING' : false} 
                desc="Ensures one ticker does not dominate the accuracy metrics." 
              />

              <CheckItem 
                label="Accuracy Audit Passing" 
                passed={Object.values(report.badges).every(b => b === 'PASS')} 
                desc="Overall integrity of the prediction database is validated." 
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
