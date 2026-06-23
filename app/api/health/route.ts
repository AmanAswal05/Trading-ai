import { NextRequest, NextResponse } from 'next/server';
import { DbService } from '@/lib/db';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://localhost:8000/api';

export async function GET(req: NextRequest) {
  const statusReport: {
    frontend: string;
    database: string;
    backend: string;
    timestamp: string;
  } = {
    frontend: 'healthy',
    database: 'unknown',
    backend: 'unknown',
    timestamp: new Date().toISOString()
  };

  // 1. Check local/Supabase database connectivity
  try {
    await DbService.listScans(null);
    statusReport.database = `connected (${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Supabase' : 'Mock Mode Fallback'})`;
  } catch (error: unknown) {
    statusReport.database = `error: ${error instanceof Error ? error.message : String(error)}`;
    statusReport.frontend = 'degraded';
  }

  // 2. Check backend health if endpoint exists
  try {
    const res = await fetch(`${BACKEND_URL.replace('/api', '')}/api/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      statusReport.backend = data.status || 'healthy';
    } else {
      statusReport.backend = `offline (status ${res.status})`;
    }
  } catch (error: unknown) {
    // In local standalone deployments, we degrade backend health gracefully
    statusReport.backend = `offline (local default: ${error instanceof Error ? error.message : String(error)})`;
  }

  return NextResponse.json({
    success: statusReport.frontend === 'healthy',
    data: statusReport
  });
}
