// ─── GET /api/backtest/results/[jobId] ───────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { getResults, getJob } from '../../../../../lib/backtesting/data-cache';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  if (job.status !== 'COMPLETED') {
    return NextResponse.json({
      error: 'Results not ready',
      status: job.status,
      progress: job.progress,
    }, { status: 202 });
  }

  const results = getResults(jobId);
  if (!results) {
    return NextResponse.json({ error: 'Results not found' }, { status: 404 });
  }

  return NextResponse.json(results);
}
