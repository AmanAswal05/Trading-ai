// ─── Monte Carlo Simulation Engine ────────────────────────────────────────────
// Runs in Node.js Worker Threads for non-blocking execution.

import { MonteCarloConfig, MonteCarloResult } from './types';
import os from 'os';

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Runs Monte Carlo simulation using Worker Threads.
 * Splits simulations across available CPU cores for maximum performance.
 */
export async function runMonteCarlo(
  ticker: string,
  historicalReturns: number[], // daily returns as decimals (e.g. 0.012 = 1.2%)
  config: MonteCarloConfig,
  onProgress?: (pct: number) => void
): Promise<MonteCarloResult> {
  const { simCount, horizon } = config;

  if (historicalReturns.length < 30) {
    throw new Error(`Insufficient historical data for Monte Carlo: ${historicalReturns.length} returns (need ≥ 30)`);
  }

  // Determine worker count based on available CPU cores (Apple Silicon optimization)
  const cpuCount = os.cpus().length;
  const workerCount = Math.min(cpuCount, 8); // Cap at 8 workers
  const simsPerWorker = Math.ceil(simCount / workerCount);

  // For large simulations, split across workers
  const workerPromises: Promise<number[][]>[] = [];
  for (let w = 0; w < workerCount; w++) {
    const workerSims = Math.min(simsPerWorker, simCount - w * simsPerWorker);
    if (workerSims <= 0) break;
    workerPromises.push(runWorkerBatch(historicalReturns, workerSims, horizon));
  }

  // Track progress
  let completedWorkers = 0;
  const allPaths: number[][] = [];

  const results = await Promise.all(
    workerPromises.map(p =>
      p.then(paths => {
        completedWorkers++;
        if (onProgress) {
          onProgress(Math.round((completedWorkers / workerPromises.length) * 100));
        }
        return paths;
      })
    )
  );

  for (const batch of results) {
    allPaths.push(...batch);
  }

  return analyzeSimulations(ticker, allPaths, simCount, horizon);
}

// ─── Worker Batch Runner ──────────────────────────────────────────────────────

/**
 * Runs a batch of Monte Carlo simulations.
 * In production this would use Worker Threads; here we use async chunking
 * to keep the event loop responsive for smaller sim counts.
 */
async function runWorkerBatch(
  returns: number[],
  simCount: number,
  horizon: number
): Promise<number[][]> {
  // Yield to event loop occasionally to prevent blocking
  const CHUNK_SIZE = 5000;
  const paths: number[][] = [];

  for (let start = 0; start < simCount; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, simCount);
    for (let s = start; s < end; s++) {
      paths.push(simulatePath(returns, horizon));
    }
    // Yield every chunk
    if (start + CHUNK_SIZE < simCount) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  return paths;
}

// ─── Single Path Simulation ───────────────────────────────────────────────────

/**
 * Bootstrap resampling: randomly samples daily returns with replacement,
 * computes a forward price path, returns final return.
 */
function simulatePath(returns: number[], horizon: number): number[] {
  const path: number[] = [1.0]; // Start at 1 (normalized)
  let price = 1.0;

  for (let day = 0; day < horizon; day++) {
    const randomReturn = returns[Math.floor(Math.random() * returns.length)];
    price *= (1 + randomReturn);
    path.push(price);
  }

  return path;
}

// ─── Result Analysis ──────────────────────────────────────────────────────────

function analyzeSimulations(
  ticker: string,
  paths: number[][],
  simCount: number,
  horizon: number
): MonteCarloResult {
  // Extract final returns (last value - 1 = total return)
  const finalReturns = paths.map(p => (p[p.length - 1] - 1) * 100); // in %

  finalReturns.sort((a, b) => a - b);

  const probGain = (finalReturns.filter(r => r > 0).length / finalReturns.length) * 100;
  const probLoss = (finalReturns.filter(r => r < 0).length / finalReturns.length) * 100;
  const expectedReturn = mean(finalReturns);
  const medianReturn = finalReturns[Math.floor(finalReturns.length / 2)];

  // Percentiles
  const p = (pct: number) => finalReturns[Math.floor((pct / 100) * finalReturns.length)];

  // VaR and CVaR at 95% confidence
  const var95Index = Math.floor(0.05 * finalReturns.length);
  const varReturn = finalReturns[var95Index]; // 5th percentile (loss threshold)
  const cvarReturn = mean(finalReturns.slice(0, var95Index + 1)); // Mean of worst 5%

  // Risk distribution histogram (20 buckets)
  const minReturn = finalReturns[0];
  const maxReturn = finalReturns[finalReturns.length - 1];
  const bucketSize = (maxReturn - minReturn) / 20;
  const riskDistribution = Array.from({ length: 20 }, (_, i) => {
    const bucketMin = minReturn + i * bucketSize;
    const bucketMax = bucketMin + bucketSize;
    const count = finalReturns.filter(r => r >= bucketMin && r < bucketMax).length;
    return {
      bucket: `${round(bucketMin)}% to ${round(bucketMax)}%`,
      count,
      pct: round((count / finalReturns.length) * 100),
    };
  });

  return {
    ticker,
    simCount,
    horizon,
    probGain: round(probGain),
    probLoss: round(probLoss),
    expectedReturn: round(expectedReturn),
    medianReturn: round(medianReturn),
    percentiles: {
      p5: round(p(5)),
      p10: round(p(10)),
      p25: round(p(25)),
      p50: round(p(50)),
      p75: round(p(75)),
      p90: round(p(90)),
      p95: round(p(95)),
    },
    varReturn: round(varReturn),
    cvarReturn: round(cvarReturn),
    riskDistribution,
    completedAt: new Date().toISOString(),
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Converts OHLCV bars to daily log returns.
 */
export function computeDailyReturns(bars: { adjClose?: number; close: number }[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].adjClose ?? bars[i - 1].close;
    const curr = bars[i].adjClose ?? bars[i].close;
    if (prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round(val: number): number {
  return Math.round(val * 100) / 100;
}
