// ─── SQLite OHLCV Cache Layer ──────────────────────────────────────────────────
// Server-side only. Uses better-sqlite3 for synchronous, high-performance access.

import { OHLCVBar } from './types';
import path from 'path';

let db: any = null;

function getDb() {
  if (db) return db;
  // Dynamic require so this module doesn't break on client side
  const Database = require('better-sqlite3');
  const dbPath = path.join(process.cwd(), 'backtests.db');
  db = new Database(dbPath);

  // Enable WAL mode for concurrent reads
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB cache

  // Create tables if not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS ohlcv_cache (
      ticker    TEXT NOT NULL,
      date      TEXT NOT NULL,
      open      REAL NOT NULL,
      high      REAL NOT NULL,
      low       REAL NOT NULL,
      close     REAL NOT NULL,
      volume    INTEGER NOT NULL,
      adj_close REAL,
      PRIMARY KEY (ticker, date)
    );
    CREATE INDEX IF NOT EXISTS idx_ohlcv_ticker_date ON ohlcv_cache (ticker, date);

    CREATE TABLE IF NOT EXISTS backtest_jobs (
      id            TEXT PRIMARY KEY,
      config        TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'QUEUED',
      progress      INTEGER NOT NULL DEFAULT 0,
      phase         TEXT NOT NULL DEFAULT '',
      current_ticker TEXT,
      total_tickers INTEGER NOT NULL DEFAULT 0,
      completed_tickers INTEGER NOT NULL DEFAULT 0,
      error         TEXT,
      started_at    TEXT,
      completed_at  TEXT,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backtest_results (
      job_id  TEXT NOT NULL,
      data    TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (job_id)
    );
  `);

  return db;
}

// ─── OHLCV Cache Operations ────────────────────────────────────────────────────

const INSERT_BAR = `
  INSERT OR REPLACE INTO ohlcv_cache (ticker, date, open, high, low, close, volume, adj_close)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

/**
 * Bulk-inserts OHLCV bars for a ticker into the local SQLite cache.
 */
export function putCache(ticker: string, bars: OHLCVBar[]): void {
  if (typeof window !== 'undefined' || bars.length === 0) return;
  const d = getDb();
  const insert = d.prepare(INSERT_BAR);
  const insertMany = d.transaction((rows: OHLCVBar[]) => {
    for (const bar of rows) {
      insert.run(ticker, bar.date, bar.open, bar.high, bar.low, bar.close, bar.volume, bar.adjClose ?? bar.close);
    }
  });
  insertMany(bars);
}

/**
 * Reads cached OHLCV bars for a ticker within a date range.
 */
export function getCached(ticker: string, startDate: string, endDate: string): OHLCVBar[] {
  if (typeof window !== 'undefined') return [];
  const d = getDb();
  const rows = d.prepare(`
    SELECT date, open, high, low, close, volume, adj_close
    FROM ohlcv_cache
    WHERE ticker = ? AND date >= ? AND date <= ?
    ORDER BY date ASC
  `).all(ticker, startDate, endDate);

  return rows.map((r: any) => ({
    date: r.date,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
    adjClose: r.adj_close,
  }));
}

/**
 * Checks whether the cache has complete data for a ticker in the given date range.
 */
export function isCacheWarm(ticker: string, startDate: string, endDate: string): boolean {
  if (typeof window !== 'undefined') return false;
  try {
    const d = getDb();
    const row = d.prepare(`
      SELECT COUNT(*) as cnt, MIN(date) as min_date, MAX(date) as max_date
      FROM ohlcv_cache
      WHERE ticker = ? AND date >= ? AND date <= ?
    `).get(ticker, startDate, endDate) as any;

    if (!row || row.cnt === 0) return false;

    // Need at least trading days in range (roughly 252 per year)
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const years = (endMs - startMs) / (365.25 * 24 * 3600 * 1000);
    const expectedMinBars = Math.floor(years * 200); // conservative min

    return row.cnt >= Math.max(expectedMinBars, 1);
  } catch {
    return false;
  }
}

/**
 * Returns cache statistics.
 */
export function getCacheStats(): { totalTickers: number; totalBars: number; dbSizeBytes: number } {
  if (typeof window !== 'undefined') return { totalTickers: 0, totalBars: 0, dbSizeBytes: 0 };
  try {
    const d = getDb();
    const stats = d.prepare(`
      SELECT COUNT(DISTINCT ticker) as tickers, COUNT(*) as bars FROM ohlcv_cache
    `).get() as any;
    const pageInfo = d.prepare(`PRAGMA page_count`).get() as any;
    const pageSize = d.prepare(`PRAGMA page_size`).get() as any;
    const dbSizeBytes = (pageInfo?.page_count ?? 0) * (pageSize?.page_size ?? 4096);
    return {
      totalTickers: stats?.tickers ?? 0,
      totalBars: stats?.bars ?? 0,
      dbSizeBytes,
    };
  } catch {
    return { totalTickers: 0, totalBars: 0, dbSizeBytes: 0 };
  }
}

// ─── Backtest Job Operations ───────────────────────────────────────────────────

export function createJob(id: string, config: any): void {
  if (typeof window !== 'undefined') return;
  const d = getDb();
  d.prepare(`
    INSERT OR REPLACE INTO backtest_jobs
    (id, config, status, progress, phase, total_tickers, completed_tickers, created_at)
    VALUES (?, ?, 'QUEUED', 0, 'Queued', ?, 0, ?)
  `).run(id, JSON.stringify(config), config.tickers?.length ?? 0, new Date().toISOString());
}

export function updateJobStatus(id: string, fields: {
  status?: string;
  progress?: number;
  phase?: string;
  currentTicker?: string;
  completedTickers?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}): void {
  if (typeof window !== 'undefined') return;
  const d = getDb();
  const sets: string[] = [];
  const vals: any[] = [];
  if (fields.status !== undefined) { sets.push('status = ?'); vals.push(fields.status); }
  if (fields.progress !== undefined) { sets.push('progress = ?'); vals.push(fields.progress); }
  if (fields.phase !== undefined) { sets.push('phase = ?'); vals.push(fields.phase); }
  if (fields.currentTicker !== undefined) { sets.push('current_ticker = ?'); vals.push(fields.currentTicker); }
  if (fields.completedTickers !== undefined) { sets.push('completed_tickers = ?'); vals.push(fields.completedTickers); }
  if (fields.error !== undefined) { sets.push('error = ?'); vals.push(fields.error); }
  if (fields.startedAt !== undefined) { sets.push('started_at = ?'); vals.push(fields.startedAt); }
  if (fields.completedAt !== undefined) { sets.push('completed_at = ?'); vals.push(fields.completedAt); }
  if (sets.length === 0) return;
  vals.push(id);
  d.prepare(`UPDATE backtest_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function getJob(id: string): any | null {
  if (typeof window !== 'undefined') return null;
  try {
    const d = getDb();
    const row = d.prepare(`SELECT * FROM backtest_jobs WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      config: JSON.parse(row.config),
      status: row.status,
      progress: row.progress,
      phase: row.phase,
      currentTicker: row.current_ticker,
      totalTickers: row.total_tickers,
      completedTickers: row.completed_tickers,
      error: row.error,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  } catch {
    return null;
  }
}

export function saveResults(jobId: string, results: any): void {
  if (typeof window !== 'undefined') return;
  const d = getDb();
  d.prepare(`
    INSERT OR REPLACE INTO backtest_results (job_id, data, created_at)
    VALUES (?, ?, ?)
  `).run(jobId, JSON.stringify(results), new Date().toISOString());
}

export function getResults(jobId: string): any | null {
  if (typeof window !== 'undefined') return null;
  try {
    const d = getDb();
    const row = d.prepare(`SELECT data FROM backtest_results WHERE job_id = ?`).get(jobId) as any;
    if (!row) return null;
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}
