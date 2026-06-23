import { NextRequest, NextResponse } from 'next/server';
import { PredictionsDbService } from '@/lib/predictions-db';
import { JobsDbService } from '@/lib/jobs-db';
import { getStockDataInternal } from '@/lib/stock-service';
import { generatePrediction } from '@/lib/prediction-engine';


export async function POST(req: NextRequest) {
  try {
    const allPredictions = await PredictionsDbService.getAllPredictions();
    const stalePredictions = allPredictions.filter(p => !p.engineVersion);
    
    if (stalePredictions.length === 0) {
      return NextResponse.json({ message: 'No stale predictions to recompute.', count: 0 });
    }

    const jobId = 'recompute-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
    await JobsDbService.createJob(jobId, stalePredictions.length);

    (async () => {
      let processed = 0;
      let databaseWrites = 0;

      for (const oldPred of stalePredictions) {
        try {
          const stockData = await getStockDataInternal(oldPred.ticker);
          if (!stockData?.history || stockData.history.length === 0) {
             processed++;
             continue;
          }

          const targetDateStr = oldPred.prediction_date.split('T')[0];
          const histEndIndex = stockData.history.findIndex((h: any) => h.date === targetDateStr);
          if (histEndIndex <= 0) {
             processed++;
             continue;
          }

          const historyUpToDate = stockData.history.slice(0, histEndIndex + 1);
          const currentQuote = historyUpToDate[historyUpToDate.length - 1];

          const newPred = generatePrediction(
            oldPred.ticker,
            currentQuote.close,
            currentQuote.volume,
            historyUpToDate,
            stockData.indicators,
            undefined,
            oldPred.model_version || 'V1'
          );

          oldPred.engineVersion = newPred.engineVersion;
          oldPred.featureVersion = newPred.featureVersion;
          oldPred.calibrationVersion = newPred.calibrationVersion;
          oldPred.regimeVersion = newPred.regimeVersion;
          
          oldPred.confidence_score = newPred.confidence;
          oldPred.confidence_before_filter = newPred.confidenceBeforeFilter;
          oldPred.confidence_after_filter = newPred.confidenceAfterFilter ?? newPred.confidence;
          oldPred.regime = newPred.regime;
          oldPred.signal_strength = newPred.signalStrength;
          
          oldPred.predicted_direction = newPred.direction;
          
          let priceCoef = 0.04;
          if (oldPred.timeframe === '1D') priceCoef = 0.015;
          else if (oldPred.timeframe === '30D') priceCoef = 0.08;
          else if (oldPred.timeframe === '90D') priceCoef = 0.15;
          else if (oldPred.timeframe === '365D') priceCoef = 0.35;

          let predictedPrice = currentQuote.close;
          if (newPred.direction === 'UP') {
            predictedPrice = currentQuote.close * (1 + (newPred.confidence / 100) * priceCoef);
          } else if (newPred.direction === 'DOWN') {
            predictedPrice = currentQuote.close * (1 - (newPred.confidence / 100) * priceCoef);
          }
          oldPred.predicted_price = Number(predictedPrice.toFixed(2));
          oldPred.is_tradeable_signal = newPred.isTradeableSignal;

          oldPred.status = 'PENDING';
          oldPred.prediction_result = undefined;
          oldPred.actual_direction = undefined;
          oldPred.error_percentage = undefined;

          await PredictionsDbService.seedMockPredictions([oldPred]);
          databaseWrites++;
        } catch (err) {
          console.error(`Recompute failed for ${oldPred.id}`, err);
        }
        
        processed++;
        await JobsDbService.updateJobProgress(jobId, {
          status: 'RUNNING',
          progress: Math.floor((processed / stalePredictions.length) * 100),
          recordsProcessed: processed,
          databaseWrites
        });
      }
      await JobsDbService.updateJobProgress(jobId, {
        status: 'COMPLETED',
        progress: 100
      });
    })();

    return NextResponse.json({ jobId, count: stalePredictions.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
