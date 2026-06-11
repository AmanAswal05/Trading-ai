import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { PredictionsDbService, PredictionRecord } from '@/lib/predictions-db';
import { precomputeAllIndicators } from '@/lib/indicators';
import { generatePrediction } from '@/lib/prediction-engine';
import { getStockDataInternal } from '@/app/api/stock/[ticker]/route';
import { JobsDbService } from '@/lib/jobs-db';

export const dynamic = 'force-dynamic';

async function getUser(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-url')) {
    const mockUserCookie = request.cookies.get('sp_mock_user');
    if (mockUserCookie) {
      try {
        const email = decodeURIComponent(mockUserCookie.value);
        return { id: 'mock-user-id', email };
      } catch (e) {
        console.error('Failed to parse mock user cookie:', e);
      }
    }
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch (err) {
    console.error('Backtest route auth error:', err);
    return null;
  }
}

function getTimeframeDays(timeframe: string): number {
  if (timeframe === '1D') return 1;
  if (timeframe === '7D') return 7;
  if (timeframe === '30D') return 30;
  if (timeframe === '90D') return 90;
  if (timeframe === '365D') return 365;
  return 7;
}

// GET handler to poll job status
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user || !user.email || !(user.email.toLowerCase().includes('admin') || user.email.toLowerCase().endsWith('@stockpredict.ai'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 });
  }

  const job = await JobsDbService.getJobStatus(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}

// POST handler to trigger backtest seeder job
export async function POST(request: NextRequest) {
  const user = await getUser(request);

  if (!user || !user.email || !(user.email.toLowerCase().includes('admin') || user.email.toLowerCase().endsWith('@stockpredict.ai'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    
    // Check if we are requesting a cancellation
    if (body.action === 'cancel' && body.jobId) {
      const cancelledJob = await JobsDbService.cancelJob(body.jobId);
      return NextResponse.json({
        message: 'Cancellation requested successfully.',
        job: cancelledJob,
      });
    }

    const tickers = body.tickers || ['AAPL', 'MSFT', 'TSLA', 'RELIANCE.BSE'];
    const simulationDatesCount = body.simulationDatesCount || 12;

    // Pre-calculate exact prediction counts by loading stock data internally (instant in mock mode)
    let totalPredictionsCount = 0;
    const tickerInfoList = [];

    for (const ticker of tickers) {
      try {
        const stockData = await getStockDataInternal(ticker);
        const history = stockData.history;

        if (history && history.length >= 25) {
          const L = history.length;
          const step = Math.max(1, Math.floor((L - 22) / simulationDatesCount));
          let datesCount = 0;
          for (let dIndex = 20; dIndex < L - 2; dIndex += step) {
            datesCount++;
          }
          const predCount = datesCount * 15; // 5 timeframes * 3 models
          totalPredictionsCount += predCount;
          tickerInfoList.push({ ticker, history, step, predCount });
        }
      } catch (tickerErr) {
        console.error(`Error gathering metadata for ${ticker}:`, tickerErr);
      }
    }

    if (totalPredictionsCount === 0) {
      return NextResponse.json({ error: 'No valid tickers or history data found to process.' }, { status: 400 });
    }

    const jobId = 'job-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
    await JobsDbService.createJob(jobId, totalPredictionsCount);

    // Trigger asynchronous background execution
    (async () => {
      let recordsProcessed = 0;
      let recordsVerified = 0;
      let databaseWrites = 0;
      let successCount = 0;
      const failures: string[] = [];
      const seededRecords: PredictionRecord[] = [];

      try {
        await JobsDbService.updateJobProgress(jobId, { status: 'RUNNING' });

        for (const { ticker, history, step } of tickerInfoList) {
          // Check cancellation
          let currentJob = await JobsDbService.getJobStatus(jobId);
          if (currentJob?.status === 'CANCELLED') {
            break;
          }

          try {
            const L = history.length;
            const allIndicators = precomputeAllIndicators(history);

            for (let dIndex = 20; dIndex < L - 2; dIndex += step) {
              // Check cancellation inside loop
              currentJob = await JobsDbService.getJobStatus(jobId);
              if (currentJob?.status === 'CANCELLED') {
                break;
              }

              const currentQuote = history[dIndex];
              const predictionDateStr = currentQuote.date;
              const currentPrice = currentQuote.close;
              const indicators = allIndicators[dIndex];

              const timeframes = ['1D', '7D', '30D', '90D', '365D'];
              const models: ('V1' | 'V2' | 'V3')[] = ['V1', 'V2', 'V3'];

              for (const timeframe of timeframes) {
                const days = getTimeframeDays(timeframe);
                
                // Find actual future quote in history closest to target date
                const predictionDateTime = new Date(predictionDateStr).getTime();
                const targetTime = predictionDateTime + days * 24 * 60 * 60 * 1000;

                let closestQuote = null;
                let minDiff = Infinity;
                
                for (const q of history) {
                  const qTime = new Date(q.date).getTime();
                  const diff = Math.abs(qTime - targetTime);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestQuote = q;
                  }
                }

                const isFuture = targetTime > Date.now();
                const hasOutcome = closestQuote && minDiff <= 7 * 24 * 60 * 60 * 1000;

                for (const model of models) {
                  const pred = generatePrediction(
                    ticker,
                    currentPrice,
                    currentQuote.volume,
                    history.slice(0, dIndex + 1),
                    indicators,
                    undefined,
                    model
                  );

                  let priceCoef = 0.04;
                  if (timeframe === '1D') priceCoef = 0.015;
                  else if (timeframe === '30D') priceCoef = 0.08;
                  else if (timeframe === '90D') priceCoef = 0.15;
                  else if (timeframe === '365D') priceCoef = 0.35;

                  let predictedPrice = currentPrice;
                  if (pred.direction === 'UP') {
                    predictedPrice = currentPrice * (1 + (pred.confidence / 100) * priceCoef);
                  } else if (pred.direction === 'DOWN') {
                    predictedPrice = currentPrice * (1 - (pred.confidence / 100) * priceCoef);
                  }
                  predictedPrice = Number(predictedPrice.toFixed(2));

                  const record: PredictionRecord = {
                    id: Math.random().toString(36).substring(2, 15) + '-' + Date.now(),
                    user_id: 'mock-user-id',
                    ticker,
                    prediction_date: new Date(predictionDateStr).toISOString(),
                    timeframe,
                    current_price: currentPrice,
                    predicted_price: predictedPrice,
                    predicted_direction: pred.direction,
                    confidence_score: pred.confidence,
                    model_version: model,
                    status: 'PENDING',
                    created_at: new Date(predictionDateStr).toISOString(),
                    metrics: pred.probabilities ? {
                      bullish_probability: pred.probabilities.bullish,
                      bearish_probability: pred.probabilities.bearish,
                      neutral_probability: pred.probabilities.neutral,
                      bear_case_return: pred.expectedReturns?.bear || 0,
                      base_case_return: pred.expectedReturns?.base || 0,
                      bull_case_return: pred.expectedReturns?.bull || 0,
                      risk_score: pred.riskScore || 5,
                      volatility_score: pred.volatilityScore || 5,
                    } : undefined,
                    explanation: pred.explainability ? {
                      rsi_contribution: pred.explainability.rsiContribution,
                      macd_contribution: pred.explainability.macdContribution,
                      trend_contribution: pred.explainability.trendContribution,
                      volume_contribution: pred.explainability.volumeContribution,
                      volatility_contribution: pred.explainability.volatilityContribution,
                      sentiment_contribution: pred.explainability.sentimentContribution,
                      support_resistance_contribution: pred.explainability.supportResistanceContribution,
                      ai_reasoning_summary: pred.explainability.aiReasoningSummary,
                    } : undefined,
                  };

                  if (hasOutcome && closestQuote && !isFuture) {
                    const actualPrice = closestQuote.close;
                    const priceChangePercent = ((actualPrice - currentPrice) / currentPrice) * 100;
                    
                    let actualDirection: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
                    if (priceChangePercent >= 0.5) {
                      actualDirection = 'UP';
                    } else if (priceChangePercent <= -0.5) {
                      actualDirection = 'DOWN';
                    }

                    let result: 'CORRECT' | 'INCORRECT' | 'PARTIALLY_CORRECT' | 'NEUTRAL' = 'NEUTRAL';
                    if (pred.direction === actualDirection) {
                      result = pred.direction === 'NEUTRAL' ? 'NEUTRAL' : 'CORRECT';
                    } else {
                      if (pred.direction === 'NEUTRAL' || actualDirection === 'NEUTRAL') {
                        result = 'PARTIALLY_CORRECT';
                      } else {
                        result = 'INCORRECT';
                      }
                    }

                    const errorPercentage = Number((Math.abs(actualPrice - predictedPrice) / actualPrice * 100).toFixed(4));

                    record.status = 'VERIFIED';
                    record.actual_price = actualPrice;
                    record.actual_direction = actualDirection;
                    record.prediction_result = result;
                    record.error_percentage = errorPercentage;
                    record.verification_date = new Date(closestQuote.date).toISOString();
                    
                    recordsVerified++;
                    successCount += (result === 'CORRECT' ? 1 : result === 'PARTIALLY_CORRECT' ? 0.5 : 0);
                  }

                  seededRecords.push(record);
                  recordsProcessed++;
                }
              }

              // Update progress periodically (every simulation date)
              const currentProgress = Math.min(99, Math.round((recordsProcessed / totalPredictionsCount) * 100));
              await JobsDbService.updateJobProgress(jobId, {
                progress: currentProgress,
                recordsProcessed,
                recordsVerified,
                successRate: recordsVerified > 0 ? Math.round((successCount / recordsVerified) * 100) : 0,
              });
            }
          } catch (tickerErr: any) {
            console.error(`Error processing simulations for ${ticker}:`, tickerErr);
            failures.push(`Stock ${ticker} failed: ${tickerErr.message || tickerErr}`);
          }
        }

        // Final check for cancellation before database write
        const finalJobCheck = await JobsDbService.getJobStatus(jobId);
        if (finalJobCheck?.status === 'CANCELLED') {
          return;
        }

        if (seededRecords.length > 0) {
          await PredictionsDbService.seedMockPredictions(seededRecords);
          databaseWrites = seededRecords.length;
        }

        const successRate = recordsVerified > 0 ? Math.round((successCount / recordsVerified) * 100) : 0;
        await JobsDbService.updateJobProgress(jobId, {
          status: failures.length === tickers.length ? 'FAILED' : 'COMPLETED',
          progress: 100,
          recordsProcessed,
          recordsVerified,
          databaseWrites,
          successRate,
          failures,
        });

      } catch (err: any) {
        console.error('Background backtest execution failed:', err);
        await JobsDbService.updateJobProgress(jobId, {
          status: 'FAILED',
          progress: 100,
          error: err.message || 'Background execution failed',
          failures: [...failures, err.message || 'Internal error'],
        });
      }
    })();

    return NextResponse.json({
      jobId,
      status: 'QUEUED',
      totalRecords: totalPredictionsCount,
      message: 'Backtest seeder running in background.',
    }, { status: 202 });

  } catch (err: any) {
    console.error('Backtest route failed to start:', err);
    return NextResponse.json({ error: err.message || 'Failed to start backtesting execution.' }, { status: 500 });
  }
}
