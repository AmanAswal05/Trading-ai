
import React from 'react';
import { Play, Database, RefreshCw, XCircle } from 'lucide-react';

export default function BacktestModal(props: any) {
  const { activeJobId, jobProgress, cancelBacktestJob, setActiveJobId, setJobProgress } = props;

  return (
    <>
    {/* Background Seeder Progress Modal */}
    {activeJobId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-all">
        <div className="w-full max-w-md border border-border-custom bg-bg-card/90 rounded-2xl shadow-2xl p-6 space-y-5 flex flex-col relative overflow-hidden backdrop-filter backdrop-blur-lg">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-accent-blue animate-pulse" />
              <h3 className="text-sm font-bold text-text-primary">Backtest Seeding Job</h3>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              jobProgress?.status === 'COMPLETED'
                ? 'bg-accent-green/10 text-accent-green border border-accent-green/25'
                : jobProgress?.status === 'RUNNING'
                ? 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/25 animate-pulse'
                : jobProgress?.status === 'FAILED'
                ? 'bg-accent-red/10 text-accent-red border border-accent-red/25'
                : jobProgress?.status === 'CANCELLED'
                ? 'bg-text-muted/10 text-text-muted border border-text-muted/20'
                : 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
            }`}>
              {jobProgress?.status || 'QUEUED'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-text-secondary">Progress</span>
              <span className="text-text-primary font-mono">{jobProgress?.progress || 0}%</span>
            </div>
            <div className="w-full h-3 bg-bg-secondary rounded-full overflow-hidden border border-border-custom">
              <div 
                className="h-full bg-gradient-to-r from-accent-blue to-premium-gold transition-all duration-300 ease-out rounded-full" 
                style={{ width: `${jobProgress?.progress || 0}%` }}
              />
            </div>
          </div>

          {/* Stats Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 border border-border-custom bg-bg-secondary/40 rounded-xl">
              <span className="text-[10px] text-text-muted font-semibold block uppercase">Processed</span>
              <span className="text-sm font-bold font-mono text-text-primary mt-1 block">
                {jobProgress?.recordsProcessed || 0} / {jobProgress?.totalRecords || 0}
              </span>
            </div>
            <div className="p-3 border border-border-custom bg-bg-secondary/40 rounded-xl">
              <span className="text-[10px] text-text-muted font-semibold block uppercase">Verified Outcomes</span>
              <span className="text-sm font-bold font-mono text-text-primary mt-1 block">
                {jobProgress?.recordsVerified || 0}
              </span>
            </div>
            <div className="p-3 border border-border-custom bg-bg-secondary/40 rounded-xl">
              <span className="text-[10px] text-text-muted font-semibold block uppercase">Database Writes</span>
              <span className="text-sm font-bold font-mono text-text-primary mt-1 block">
                {jobProgress?.databaseWrites || 0}
              </span>
            </div>
            <div className="p-3 border border-border-custom bg-bg-secondary/40 rounded-xl">
              <span className="text-[10px] text-text-muted font-semibold block uppercase">Success Rate</span>
              <span className="text-sm font-bold font-mono text-accent-green mt-1 block">
                {jobProgress?.successRate || 0}%
              </span>
            </div>
          </div>

          {/* Remaining Time & Duration */}
          <div className="flex justify-between items-center text-[11px] font-mono text-text-muted">
            <span>Time: {((jobProgress?.executionTime || 0) / 1000).toFixed(1)}s</span>
            {jobProgress?.status === 'RUNNING' && jobProgress?.estimatedTimeRemaining > 0 && (
              <span className="text-accent-yellow">
                Remaining: ~{jobProgress?.estimatedTimeRemaining}s
              </span>
            )}
          </div>

          {/* Failure log indicator if any failed */}
          {jobProgress?.failures && jobProgress.failures.length > 0 && (
            <div className="p-2.5 border border-accent-red/20 bg-accent-red/5 rounded-xl text-[10px] text-accent-red max-h-20 overflow-y-auto space-y-1">
              <span className="font-bold uppercase">Errors logged:</span>
              {jobProgress.failures.map((f: string, idx: number) => (
                <div key={idx} className="font-mono">{f}</div>
              ))}
            </div>
          )}

          {/* Cancel / Action Button */}
          <div className="flex gap-2.5 pt-2">
            {(jobProgress?.status === 'RUNNING' || jobProgress?.status === 'QUEUED' || activeJobId === 'initializing') ? (
              <button
                onClick={cancelBacktestJob}
                disabled={activeJobId === 'initializing'}
                className="w-full h-10 flex items-center justify-center bg-accent-red/10 text-accent-red border border-accent-red/25 hover:bg-accent-red/20 font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Cancel Seeder Job
              </button>
            ) : (
              <button
                onClick={() => {
                  setActiveJobId(null);
                  setJobProgress(null);
                }}
                className="w-full h-10 flex items-center justify-center bg-bg-secondary hover:bg-bg-card-hover border border-border-custom text-text-primary font-semibold rounded-xl text-xs transition-all cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>

        </div>
      </div>
    )}
    </>
  );
}
