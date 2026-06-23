/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
// ─── GET /api/backtest/status/[jobId] ─────────────────────────────────────────
// Server-Sent Events (SSE) stream for real-time progress

import { NextRequest } from 'next/server';
import { getJob } from '../../../../../lib/backtesting/data-cache';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        const msg = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(msg));
      };

      // Poll job status every 1.5 seconds
      let attempts = 0;
      const MAX_ATTEMPTS = 400; // ~10 minutes

      const poll = async () => {
        if (attempts++ > MAX_ATTEMPTS) {
          send({ type: 'timeout', message: 'Polling timeout' });
          controller.close();
          return;
        }

        const job = getJob(jobId) as Record<string, any>;
        if (!job) {
          send({ type: 'error', message: `Job ${jobId} not found` });
          controller.close();
          return;
        }

        send({
          type: 'progress',
          jobId: job.id,
          status: job.status,
          progress: job.progress,
          phase: job.phase,
          currentTicker: job.currentTicker,
          totalTickers: job.totalTickers,
          completedTickers: job.completedTickers,
          startedAt: job.startedAt,
          error: job.error,
        });

        if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
          send({ type: 'done', status: job.status });
          controller.close();
          return;
        }

        // Continue polling
        await new Promise(r => setTimeout(r, 1500));
        await poll();
      };

      try {
        await poll();
      } catch (err) {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
