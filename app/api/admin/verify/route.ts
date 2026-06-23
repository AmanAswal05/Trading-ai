import { NextRequest, NextResponse } from 'next/server';
import { PredictionsDbService } from '@/lib/predictions-db';
import { StockData } from '@/types/stock';
import { getAuthenticatedAdmin } from '@/lib/admin-api-auth';
import { classifySignalStrength } from '@/lib/prediction-analytics';

export const dynamic = 'force-dynamic';

function getTimeframeDays(timeframe: string): number {
  if (timeframe === '1D') return 1;
  if (timeframe === '7D') return 7;
  if (timeframe === '30D') return 30;
  if (timeframe === '90D') return 90;
  if (timeframe === '365D') return 365;
  return 7; // Default fallback
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedAdmin(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    const pendingPredictions = await PredictionsDbService.getPendingPredictions();
    
    if (pendingPredictions.length === 0) {
      return NextResponse.json({ message: 'No pending predictions to verify.', verifiedCount: 0 });
    }

    const now = new Date();
    const verifiedPredictions = [];
    const stockCache: Record<string, StockData> = {};

    for (const pred of pendingPredictions) {
      const predDate = new Date(pred.prediction_date);
      const days = getTimeframeDays(pred.timeframe);
      const targetTime = predDate.getTime() + days * 24 * 60 * 60 * 1000;

      // Check if prediction is expired
      if (now.getTime() < targetTime) {
        continue; // Skip predictions that haven't reached target date yet
      }

      // Fetch stock data for historical outcome
      let stockData = stockCache[pred.ticker];
      if (!stockData) {
        try {
          const baseUrl = request.nextUrl.origin;
          const res = await fetch(`${baseUrl}/api/stock/${pred.ticker}`, { cache: 'no-store' });
          if (res.ok) {
            stockData = await res.json();
            stockCache[pred.ticker] = stockData;
          }
        } catch (err) {
          console.error(`Failed to fetch stock data for ticker ${pred.ticker}:`, err);
        }
      }

      if (!stockData || !stockData.history || stockData.history.length === 0) {
        continue; // Skip if we cannot retrieve stock history
      }

      // Find the historical quote closest to the targetTime
      let closestQuote = null;
      let minDiff = Infinity;

      for (const quote of stockData.history) {
        const quoteTime = new Date(quote.date).getTime();
        const diff = Math.abs(quoteTime - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestQuote = quote;
        }
      }

      // Ensure the quote is within a reasonable window (e.g. 5 days) of target date
      // to handle weekends, holidays, and short data timelines.
      if (closestQuote && minDiff <= 5 * 24 * 60 * 60 * 1000) {
        const actualPrice = closestQuote.close;
        const currentPrice = pred.current_price;
        const predictedPrice = pred.predicted_price;
        
        // Calculate price movement percentage
        const priceChangePercent = ((actualPrice - currentPrice) / currentPrice) * 100;
        
        // Determine actual direction (using +/- 0.5% threshold)
        let actualDirection: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
        if (priceChangePercent >= 0.5) {
          actualDirection = 'UP';
        } else if (priceChangePercent <= -0.5) {
          actualDirection = 'DOWN';
        }

        // Classify prediction result
        let result: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT' | 'NEUTRAL' = 'NEUTRAL';
        if (pred.predicted_direction === actualDirection) {
          result = pred.predicted_direction === 'NEUTRAL' ? 'NEUTRAL' : 'CORRECT';
        } else {
          if (pred.predicted_direction === 'NEUTRAL' || actualDirection === 'NEUTRAL') {
            result = 'PARTIALLY_CORRECT';
          } else {
            result = 'INCORRECT'; // Opposite direction
          }
        }

        // Calculate absolute error percentage
        const errorPercentage = Number((Math.abs(actualPrice - predictedPrice) / actualPrice * 100).toFixed(4));

        const updates = {
          actual_price: actualPrice,
          actual_direction: actualDirection,
          prediction_result: result,
          error_percentage: errorPercentage,
          verification_date: new Date().toISOString(),
        };

        // Update database record
        await PredictionsDbService.updateVerifiedPrediction(pred.id, updates);
        
        verifiedPredictions.push({
          id: pred.id,
          ticker: pred.ticker,
          timeframe: pred.timeframe,
          predicted: pred.predicted_direction,
          actual: actualDirection,
          result: result,
          errorPct: errorPercentage,
          signalStrength: classifySignalStrength(pred.confidence_score),
        });
      }
    }

    return NextResponse.json({
      message: `Successfully verified predictions.`,
      verifiedCount: verifiedPredictions.length,
      verified: verifiedPredictions,
    });
  } catch (err: any) {
    console.error('Verify route execution failed:', err);
    return NextResponse.json({ error: err.message || 'Verification execution failed.' }, { status: 500 });
  }
}
