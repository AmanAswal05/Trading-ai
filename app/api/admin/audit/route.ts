import { NextRequest, NextResponse } from 'next/server';
import { calculateIndicators } from '@/lib/indicators';
import { generatePrediction, TuningConfig } from '@/lib/prediction-engine';
import { StockData, HistoricalQuote } from '@/types/stock';
import { getAuthenticatedAdmin } from '@/lib/admin-api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedAdmin(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const ticker = (body.ticker || 'AAPL').toUpperCase();
    const tuningConfig: TuningConfig = body.tuningConfig;

    // Fetch stock data using absolute URL or internal fetch simulation
    const baseUrl = request.nextUrl.origin;
    const stockRes = await fetch(`${baseUrl}/api/stock/${ticker}`, { cache: 'no-store' });
    if (!stockRes.ok) {
      throw new Error(`Failed to fetch stock data for ${ticker}`);
    }

    const stockData: StockData = await stockRes.json();
    const history = stockData.history;

    if (!history || history.length < 50) {
      return NextResponse.json({ error: `Insufficient history for ${ticker} to run an audit. (Requires >= 50 trading days).` }, { status: 400 });
    }

    // Run accuracy backtest
    // We will evaluate predictions for index `i` from length-40 down to length-6
    // This gives us a 35-day window, and ensures we have a 5-day future window to check accuracy
    const L = history.length;
    const auditWindow = 35;
    const startIndex = Math.max(20, L - auditWindow - 5);
    const endIndex = L - 6;

    const auditHistory: any[] = [];
    let correctSignals = 0;
    let totalSignals = 0;

    for (let i = startIndex; i <= endIndex; i++) {
      const slice = history.slice(0, i + 1);
      const currentQuote = history[i];
      const futureQuote = history[i + 5];

      // Calculate indicators for this slice
      const indicators = calculateIndicators(slice);

      // Generate prediction for this slice
      const pred = generatePrediction(
        ticker,
        currentQuote.close,
        currentQuote.volume,
        slice,
        indicators,
        tuningConfig
      );

      const initialPrice = currentQuote.close;
      const finalPrice = futureQuote.close;
      const actualDeltaPercent = ((finalPrice - initialPrice) / initialPrice) * 100;
      
      let actualDirection: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
      if (actualDeltaPercent >= 0.5) {
        actualDirection = 'UP';
      } else if (actualDeltaPercent <= -0.5) {
        actualDirection = 'DOWN';
      }

      let success = false;
      let signalTreated = false;

      if (pred.direction !== 'NEUTRAL') {
        signalTreated = true;
        totalSignals++;
        if (pred.direction === actualDirection) {
          correctSignals++;
          success = true;
        }
      }

      auditHistory.push({
        date: currentQuote.date,
        priceAtSignal: initialPrice,
        price5DaysLater: finalPrice,
        priceChangePercent: Number(actualDeltaPercent.toFixed(2)),
        predictedDirection: pred.direction,
        actualDirection,
        confidence: pred.confidence,
        success,
        signalTreated
      });
    }

    const accuracy = totalSignals > 0 ? Number(((correctSignals / totalSignals) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      ticker,
      accuracy,
      totalSignals,
      correctSignals,
      auditHistory: auditHistory.reverse() // latest first
    });

  } catch (err: any) {
    console.error('Audit execution error:', err);
    return NextResponse.json({ error: err.message || 'Audit execution failed.' }, { status: 500 });
  }
}
