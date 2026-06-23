"use client";

import React, { useEffect, useState } from 'react';

interface AuditIssue {
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  date?: string;
}

interface DataQualityReport {
  ticker: string;
  totalRecords: number;
  qualityScore: number;
  isTrainable: boolean;
  issues: AuditIssue[];
  issueCounts: Record<string, number>;
}

export default function DataQualityDashboard() {
  const [reports, setReports] = useState<DataQualityReport[]>([]);
  const [averageScore, setAverageScore] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch('/api/data-quality')
      .then(res => res.json())
      .then(data => {
        if (data.reports) {
          setReports(data.reports);
          setAverageScore(data.averageScore);
        } else {
          setError("Failed to load reports");
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading Data Quality Audit...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  const blockedStocks = reports.filter(r => !r.isTrainable);
  const bestStock = reports.reduce((prev, current) => (prev.qualityScore > current.qualityScore) ? prev : current, reports[0]);
  const worstStock = reports.reduce((prev, current) => (prev.qualityScore < current.qualityScore) ? prev : current, reports[0]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white tracking-tight">Data Quality Audit (Priority 9)</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <p className="text-gray-400 text-sm font-medium">Average Quality Score</p>
          <div className={`text-4xl font-bold mt-2 ${averageScore >= 90 ? 'text-green-400' : averageScore >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {averageScore.toFixed(1)} / 100
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <p className="text-gray-400 text-sm font-medium">Blocked Datasets</p>
          <div className="text-4xl font-bold mt-2 text-red-400">
            {blockedStocks.length} <span className="text-lg font-normal text-gray-500">/ {reports.length} stocks</span>
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <p className="text-gray-400 text-sm font-medium">Best / Worst Stock</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-green-400 font-bold">{bestStock?.ticker} ({bestStock?.qualityScore})</span>
            <span className="text-red-400 font-bold">{worstStock?.ticker} ({worstStock?.qualityScore})</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Stock-Level Quality Reports</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-900 text-gray-400 text-sm uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Symbol</th>
                <th className="px-6 py-4 font-medium">Score</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Total Issues</th>
                <th className="px-6 py-4 font-medium">Issue Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {reports.map((report) => (
                <tr key={report.ticker} className="hover:bg-gray-750 transition-colors">
                  <td className="px-6 py-4 font-bold text-white">{report.ticker}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-sm font-bold ${
                      report.qualityScore >= 90 ? 'bg-green-500/20 text-green-400' :
                      report.qualityScore >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {report.qualityScore}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {report.isTrainable ? (
                      <span className="text-green-400 text-sm flex items-center gap-1">
                        ✓ Trainable
                      </span>
                    ) : (
                      <span className="text-red-400 text-sm font-bold flex items-center gap-1">
                        ✗ Blocked (Failed Audit)
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {report.issues.length} issues
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(report.issueCounts).map(([type, count]) => (
                        <span key={type} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300 border border-gray-600">
                          {type}: {count}
                        </span>
                      ))}
                      {Object.keys(report.issueCounts).length === 0 && (
                        <span className="text-green-400 text-sm">Perfect Data</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {blockedStocks.length > 0 && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6">
          <h2 className="text-red-400 font-bold mb-4">Critical Data Quality Warnings</h2>
          <div className="space-y-4">
            {blockedStocks.map(stock => (
              <div key={stock.ticker} className="bg-gray-900 rounded p-4 border border-red-500/20">
                <h3 className="font-bold text-white mb-2">{stock.ticker} - Top 3 Issues</h3>
                <ul className="space-y-2">
                  {stock.issues.slice(0, 3).map((issue, idx) => (
                    <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>
                        <strong className="text-gray-200">{issue.type}</strong>: {issue.description}
                        {issue.date && <span className="text-gray-500 ml-2">({issue.date})</span>}
                      </span>
                    </li>
                  ))}
                  {stock.issues.length > 3 && (
                    <li className="text-sm text-gray-500 italic pl-4">...and {stock.issues.length - 3} more issues</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
