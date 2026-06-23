'use client';

import { useEffect, useState } from 'react';
import { FailureAnalysisReport, AggregateMetrics, FailureReason } from '@/lib/failureAnalysis';
import { AlertCircle, Download, ArrowDown, ArrowUp, Activity } from 'lucide-react';

export default function FailureAnalysisPage() {
  const [report, setReport] = useState<FailureAnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'stocks'|'sectors'|'regimes'|'timeframes'|'confidence'|'reasons'>('stocks');

  useEffect(() => {
    fetch('/api/failure-analysis')
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setReport(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const exportReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failure-analysis-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-red-400 p-4 border border-red-500/30 rounded-lg bg-red-500/10 max-w-lg text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8" />
          <h2 className="text-lg font-bold">Failed to Load Report</h2>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  // Calculate top-level stats
  const worstStock = [...report.stocks].filter(s => !s.sampleSizeWarning).sort((a, b) => a.accuracy - b.accuracy)[0];
  const worstSector = [...report.sectors].filter(s => !s.sampleSizeWarning).sort((a, b) => a.accuracy - b.accuracy)[0];
  const worstRegime = [...report.combinedRegimes].filter(s => !s.sampleSizeWarning).sort((a, b) => a.accuracy - b.accuracy)[0];
  const mostOverconfident = [...report.confidenceBuckets].filter(s => !s.sampleSizeWarning).sort((a, b) => b.calibrationGap - a.calibrationGap)[0];

  const renderTable = (data: AggregateMetrics[], columns: { label: string, key: keyof AggregateMetrics }[]) => (
    <div className="overflow-x-auto border border-gray-800 rounded-lg">
      <table className="w-full text-sm text-left text-gray-300">
        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
          <tr>
            <th className="px-4 py-3">Name</th>
            {columns.map(c => <th key={c.key} className="px-4 py-3">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.sort((a, b) => b.totalPredictions - a.totalPredictions).map(row => (
            <tr key={row.key} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-100">
                {row.key}
                {row.sampleSizeWarning && <span className="ml-2 text-xs text-yellow-500" title="Low sample size — metric may be unreliable.">⚠️ Low Sample</span>}
              </td>
              {columns.map(c => (
                <td key={c.key} className="px-4 py-3">
                  {typeof row[c.key] === 'number' && (c.key.toString().includes('accuracy') || c.key.toString().includes('Gap') || c.key.toString().includes('ece')) 
                    ? `${(row[c.key] as number).toFixed(1)}%` 
                    : typeof row[c.key] === 'number' && c.key === 'brierScore'
                    ? (row[c.key] as number).toFixed(4)
                    : row[c.key] as any}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Activity className="h-8 w-8 text-indigo-500" />
              Failure Analysis Dashboard
            </h1>
            <p className="text-gray-400 mt-1 text-sm">Systematic breakdown of model performance and blind spots.</p>
          </div>
          <button 
            onClick={exportReport}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            Export JSON
          </button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <OverviewCard title="Worst Stock (>50 preds)" value={worstStock?.key || 'N/A'} subValue={worstStock ? `Accuracy: ${worstStock.accuracy.toFixed(1)}%` : ''} icon={<ArrowDown className="text-red-500" />} />
          <OverviewCard title="Worst Sector (>100 preds)" value={worstSector?.key || 'N/A'} subValue={worstSector ? `Accuracy: ${worstSector.accuracy.toFixed(1)}%` : ''} icon={<ArrowDown className="text-red-500" />} />
          <OverviewCard title="Worst Regime (>100 preds)" value={worstRegime?.key || 'N/A'} subValue={worstRegime ? `Accuracy: ${worstRegime.accuracy.toFixed(1)}%` : ''} icon={<ArrowDown className="text-orange-500" />} />
          <OverviewCard title="Most Overconfident" value={mostOverconfident?.key || 'N/A'} subValue={mostOverconfident ? `Gap: +${mostOverconfident.calibrationGap.toFixed(1)}%` : ''} icon={<ArrowUp className="text-yellow-500" />} />
        </div>

        {/* Recommendations Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-3">Actionable Recommendations</h2>
          <div className="space-y-2">
            {[...report.sectors, ...report.trendRegimes, ...report.confidenceBuckets]
              .filter(item => item.recommendation)
              .map((item, idx) => (
                <div key={idx} className="flex gap-3 text-sm text-gray-300 bg-gray-950 p-3 rounded-lg border border-gray-800/50">
                  <AlertCircle className="h-5 w-5 text-indigo-400 shrink-0" />
                  <span>{item.recommendation}</span>
                </div>
              ))}
            {[...report.sectors, ...report.trendRegimes, ...report.confidenceBuckets].filter(i => i.recommendation).length === 0 && (
              <p className="text-sm text-gray-500">No critical recommendations generated based on current sample sizes.</p>
            )}
          </div>
        </div>

        {/* Tabs & Tables */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-800 scrollbar-hide">
            {(['stocks', 'sectors', 'regimes', 'timeframes', 'confidence', 'reasons'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab 
                  ? 'border-b-2 border-indigo-500 text-white' 
                  : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          
          <div className="p-5">
            {activeTab === 'stocks' && renderTable(report.stocks, [
              { label: 'Predictions', key: 'totalPredictions' },
              { label: 'Accuracy', key: 'accuracy' },
              { label: 'Tradeable Acc', key: 'tradeableAccuracy' },
              { label: 'Avg Conf', key: 'averageConfidence' },
              { label: 'Calib Gap', key: 'calibrationGap' },
              { label: 'ECE', key: 'ece' },
            ])}
            {activeTab === 'sectors' && renderTable(report.sectors, [
              { label: 'Predictions', key: 'totalPredictions' },
              { label: 'Accuracy', key: 'accuracy' },
              { label: 'Tradeable Acc', key: 'tradeableAccuracy' },
              { label: 'Win/Loss', key: 'winLossRatio' },
              { label: 'Calib Gap', key: 'calibrationGap' },
            ])}
            {activeTab === 'regimes' && renderTable(report.combinedRegimes, [
              { label: 'Predictions', key: 'totalPredictions' },
              { label: 'Accuracy', key: 'accuracy' },
              { label: 'Tradeable Acc', key: 'tradeableAccuracy' },
              { label: 'Avg Conf', key: 'averageConfidence' },
              { label: 'Calib Gap', key: 'calibrationGap' },
            ])}
            {activeTab === 'timeframes' && renderTable(report.timeframes, [
              { label: 'Predictions', key: 'totalPredictions' },
              { label: 'Accuracy', key: 'accuracy' },
              { label: 'Tradeable Acc', key: 'tradeableAccuracy' },
              { label: 'Calib Gap', key: 'calibrationGap' },
            ])}
            {activeTab === 'confidence' && renderTable(report.confidenceBuckets, [
              { label: 'Predictions', key: 'totalPredictions' },
              { label: 'Avg Conf', key: 'averageConfidence' },
              { label: 'Actual Win Rate', key: 'accuracy' },
              { label: 'Calib Gap', key: 'calibrationGap' },
            ])}
            {activeTab === 'reasons' && (
              <div className="overflow-x-auto border border-gray-800 rounded-lg">
                <table className="w-full text-sm text-left text-gray-300">
                  <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                    <tr>
                      <th className="px-4 py-3">Failure Reason</th>
                      <th className="px-4 py-3">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(report.topFailureReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                      <tr key={reason} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="px-4 py-3 font-medium text-gray-100">{reason}</td>
                        <td className="px-4 py-3">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function OverviewCard({ title, value, subValue, icon }: { title: string, value: string, subValue: string, icon: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">{title}</span>
        {icon}
      </div>
      <div>
        <h3 className="text-xl font-bold text-white truncate" title={value}>{value}</h3>
        <p className="text-sm text-gray-400 mt-1">{subValue}</p>
      </div>
    </div>
  );
}
