// ─── POST /api/backtest/run ───────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '../../../../lib/backtesting/data-cache';
import { BacktestConfig } from '../../../../lib/backtesting/types';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const jobId = randomUUID();

    const config: BacktestConfig = {
      id: jobId,
      name: body.name ?? `Backtest ${new Date().toLocaleDateString()}`,
      timeframe: body.timeframe ?? '5Y',
      models: body.models ?? ['V1'],
      tickerMode: body.tickerMode ?? 'SINGLE',
      tickers: body.tickers ?? [],
      sector: body.sector,
      predictionHorizon: body.predictionHorizon ?? '7D',
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

    // Persist job to SQLite
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
    const { runBacktest } = await import('../../../../lib/backtesting/backtest-engine');
    const { rankModels } = await import('../../../../lib/backtesting/model-comparator');
    const { generateOptimizationRecommendations } = await import('../../../../lib/backtesting/auto-optimizer');
    const { buildReport } = await import('../../../../lib/backtesting/report-generator');
    const { saveResults } = await import('../../../../lib/backtesting/data-cache');
    const { runMonteCarlo, computeDailyReturns } = await import('../../../../lib/backtesting/monte-carlo');
    const { runStressTests } = await import('../../../../lib/backtesting/backtest-engine');
    const { getCached } = await import('../../../../lib/backtesting/data-cache');

    const { tickerResults, allRecords, walkForwardResult } = await runBacktest(jobId, config);

    const modelComparison = rankModels(allRecords);
    const optimizationRecs = generateOptimizationRecommendations(allRecords, tickerResults);

    // Monte Carlo (if enabled)
    let monteCarloResults;
    if (config.monteCarloEnabled && config.monteCarloConfig && config.tickers.length > 0) {
      monteCarloResults = [];
      const { updateJobStatus } = await import('../../../../lib/backtesting/data-cache');
      updateJobStatus(jobId, { phase: 'Running Monte Carlo simulations', progress: 85 });
      for (const ticker of config.tickers.slice(0, 3)) { // Limit to first 3 for performance
        const bars = getCached(ticker, '1970-01-01', new Date().toISOString().split('T')[0]);
        if (bars.length > 30) {
          const returns = computeDailyReturns(bars);
          const result = await runMonteCarlo(ticker, returns, config.monteCarloConfig!);
          monteCarloResults.push(result);
        }
      }
    }

    // Stress Tests (if enabled)
    let stressTestResults;
    if (config.stressTestEnabled && config.stressScenarios && config.stressScenarios.length > 0) {
      const { updateJobStatus } = await import('../../../../lib/backtesting/data-cache');
      updateJobStatus(jobId, { phase: 'Running stress tests', progress: 90 });
      stressTestResults = await runStressTests(jobId, config.tickers.slice(0, 5), config.stressScenarios as string[], config.models[0] ?? 'V1');
    }

    const report = buildReport({
      jobId,
      config,
      tickerResults,
      allRecords,
      modelComparison,
      walkForwardResult: walkForwardResult as any,
      monteCarloResults,
      stressTestResults,
      optimizationRecs,
    });

    saveResults(jobId, report);
  } catch (err: any) {
    const { updateJobStatus } = await import('../../../../lib/backtesting/data-cache');
    updateJobStatus(jobId, { status: 'FAILED', error: err.message, completedAt: new Date().toISOString() });
    console.error('[BacktestAsync]', err);
  }
}
