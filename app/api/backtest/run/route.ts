import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJobStatus, saveResults } from '../../../../lib/backtesting/data-cache';
import { BacktestConfig } from '../../../../lib/backtesting/types';
import { randomUUID } from 'crypto';
import { runBacktestEngine } from '../../../../lib/backtesting/engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobId = randomUUID();

    const config: BacktestConfig = {
      id: jobId,
      name: body.name ?? `Backtest ${new Date().toLocaleDateString()}`,
      timeframe: body.timeframe ?? '5Y',
      dataSource: body.dataSource ?? 'AUTO',
      startDate: body.startDate,
      endDate: body.endDate,
      models: body.models ?? ['V1'],
      tickerMode: body.tickerMode ?? 'SINGLE',
      tickers: body.tickers ?? [],
      sector: body.sector,
      predictionHorizon: body.predictionHorizon ?? '7D',
      initialCapital: body.initialCapital ?? 10000,
      positionSizing: body.positionSizing ?? 100,
      stopLoss: body.stopLoss ?? 5,
      takeProfit: body.takeProfit ?? 10,
      confidenceFilter: body.confidenceFilter ?? 0,
      signalStrengthFilter: body.signalStrengthFilter ?? 'ALL',
      maxTrades: body.maxTrades ?? 0,
      walkForward: body.walkForward ?? false,
      walkForwardConfig: body.walkForwardConfig,
      monteCarloEnabled: body.monteCarloEnabled ?? false,
      monteCarloConfig: body.monteCarloConfig,
      stressTestEnabled: body.stressTestEnabled ?? false,
      stressScenarios: body.stressScenarios,
      createdAt: new Date().toISOString(),
    };

    if (!config.tickers || config.tickers.length === 0) {
      return NextResponse.json({ error: 'No tickers provided' }, { status: 400 });
    }

    createJob(jobId, config);

    // Launch backtest asynchronously (fire and forget)
    launchBacktestAsync(jobId, config);

    return NextResponse.json({ jobId, status: 'QUEUED', message: 'Backtest job created' });
  } catch (err: any) {
    console.error('[/api/backtest/run]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function launchBacktestAsync(jobId: string, config: BacktestConfig) {
  try {
    const { tickerResults } = await runBacktestEngine(jobId, config);

    const report = {
      jobId,
      generatedAt: new Date().toISOString(),
      config,
      tickerResults,
      summary: {
        totalPredictions: tickerResults.reduce((sum, r) => sum + r.totalPredictions, 0),
        overallWinRate: tickerResults.length > 0 ? tickerResults.reduce((sum, r) => sum + r.winRate, 0) / tickerResults.length : 0,
        bestModel: config.models[0] || 'V1',
      }
    };

    saveResults(jobId, report);
  } catch (err: any) {
    updateJobStatus(jobId, { status: 'FAILED', error: err.message, completedAt: new Date().toISOString() });
    console.error('[BacktestAsync]', err);
  }
}
