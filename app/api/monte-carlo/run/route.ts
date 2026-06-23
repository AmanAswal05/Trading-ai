// ─── POST /api/monte-carlo/run ────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { runMonteCarlo, computeDailyReturns } from '../../../../lib/backtesting/monte-carlo';
import { fetchHistoricalOHLCV } from '../../../../lib/backtesting/data-fetcher';
import { getCached, putCache, isCacheWarm } from '../../../../lib/backtesting/data-cache';
import { MonteCarloConfig } from '../../../../lib/backtesting/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticker, simCount, horizon } = body;

    if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 });

    const validSimCounts = [100000, 250000, 500000, 1000000];
    const validatedSimCount = validSimCounts.includes(simCount) ? simCount : 100000;

    // Fetch 3 years of data for returns computation
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 3 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0];

    let bars;
    if (isCacheWarm(ticker, startDate, endDate)) {
      bars = getCached(ticker, startDate, endDate);
    } else {
      bars = await fetchHistoricalOHLCV(ticker, startDate, endDate);
      if (bars.length > 0) putCache(ticker, bars);
    }

    if (bars.length < 30) {
      return NextResponse.json({ error: 'Insufficient data for simulation' }, { status: 400 });
    }

    const returns = computeDailyReturns(bars);
    const config: MonteCarloConfig = {
      simCount: validatedSimCount as MonteCarloConfig['simCount'],
      horizon: horizon ?? 252,
    };

    const result = await runMonteCarlo(ticker, returns, config);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
