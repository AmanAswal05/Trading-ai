// ─── GET /api/backtest/report/[jobId] ────────────────────────────────────────
// Returns a downloadable HTML report

import { NextRequest, NextResponse } from 'next/server';
import { getResults, getJob } from '../../../../../lib/backtesting/data-cache';
import { exportReportAsHTML } from '../../../../../lib/backtesting/report-generator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const job = getJob(jobId);
  if (!job) return NextResponse.json({} as any);
  if (job.status !== 'COMPLETED') return NextResponse.json({} as any);

  const report = getResults(jobId);
  if (!report) return NextResponse.json({} as any);

  const html = exportReportAsHTML(report);
  const filename = `backtest-report-${jobId.slice(0, 8)}.html`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
