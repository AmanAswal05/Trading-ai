import { NextResponse } from 'next/server';
import { getWalkForwardMetrics } from '../../../../lib/backtesting/data-cache';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker') || undefined;
    
    const metrics = getWalkForwardMetrics(ticker);
    return NextResponse.json({ data: metrics });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
