import { HistoricalQuote } from '../types/stock';

export interface AuditIssue {
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  date?: string;
}

export interface DataQualityReport {
  ticker: string;
  totalRecords: number;
  qualityScore: number;
  isTrainable: boolean;
  issues: AuditIssue[];
  issueCounts: Record<string, number>;
}

export function runDataQualityAudit(ticker: string, bars: HistoricalQuote[]): DataQualityReport {
  const issues: AuditIssue[] = [];
  let score = 100;
  
  if (!bars || bars.length === 0) {
    return {
      ticker,
      totalRecords: 0,
      qualityScore: 0,
      isTrainable: false,
      issues: [{ type: 'EMPTY_DATASET', severity: 'CRITICAL', description: 'No data provided.' }],
      issueCounts: { EMPTY_DATASET: 1 }
    };
  }

  const seenDates = new Set<string>();
  
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    
    // 1. Missing Value Detection
    const hasMissing = 
      bar.open === undefined || bar.open === null || Number.isNaN(bar.open) ||
      bar.high === undefined || bar.high === null || Number.isNaN(bar.high) ||
      bar.low === undefined || bar.low === null || Number.isNaN(bar.low) ||
      bar.close === undefined || bar.close === null || Number.isNaN(bar.close) ||
      bar.volume === undefined || bar.volume === null || Number.isNaN(bar.volume) ||
      !bar.date;

    if (hasMissing) {
      issues.push({
        type: 'MISSING_VALUE',
        severity: 'CRITICAL',
        description: 'Missing required OHLCV or Date field.',
        date: bar.date
      });
      score -= 2;
    }

    // 2. OHLC Consistency
    if (!hasMissing) {
      if (bar.high < bar.open || bar.high < bar.close || bar.low > bar.open || bar.low > bar.close || bar.high < bar.low) {
        issues.push({
          type: 'BAD_OHLC_RECORD',
          severity: 'CRITICAL',
          description: `Impossible candle logic (O:${bar.open} H:${bar.high} L:${bar.low} C:${bar.close})`,
          date: bar.date
        });
        score -= 2;
      }
    }

    // 3. Volume Validation
    if (bar.volume < 0) {
      issues.push({
        type: 'INVALID_VOLUME',
        severity: 'CRITICAL',
        description: `Negative volume: ${bar.volume}`,
        date: bar.date
      });
      score -= 1;
    }

    // 4. Duplicate Timestamp
    if (bar.date) {
      if (seenDates.has(bar.date)) {
        issues.push({
          type: 'DUPLICATE_TIMESTAMP',
          severity: 'WARNING',
          description: `Duplicate date found`,
          date: bar.date
        });
        score -= 1;
      }
      seenDates.add(bar.date);
    }

    // Previous Candle Checks
    if (i > 0 && !hasMissing) {
      const prevBar = bars[i - 1];
      if (prevBar.close) {
        const change = Math.abs(bar.close - prevBar.close) / prevBar.close;
        
        // 5. Extreme Price Jump / Split Detection
        if (change > 0.4) {
          // Could be a 2:1 split or reverse split
          issues.push({
            type: 'PRICE_ANOMALY',
            severity: 'WARNING',
            description: `Extreme daily move of ${(change * 100).toFixed(1)}%. Potential unadjusted split or corporate action.`,
            date: bar.date
          });
          score -= 0.5;
        }

        // 6. Dividend Adjustment Check
        if ((bar.close - prevBar.close) / prevBar.close < -0.1) {
          // Sharp drops without corresponding market moves can be ex-dividend dates unadjusted
          issues.push({
            type: 'UNADJUSTED_DIVIDEND_CANDIDATE',
            severity: 'INFO',
            description: `Sharp drop of ${(((bar.close - prevBar.close) / prevBar.close) * 100).toFixed(1)}%. Check corporate actions.`,
            date: bar.date
          });
        }
      }

      // 7. Missing Candle Detection (Gaps)
      const currDate = new Date(bar.date);
      const prevDate = new Date(prevBar.date);
      const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 5) {
        issues.push({
          type: 'MISSING_CANDLE_GAP',
          severity: 'WARNING',
          description: `Gap of ${diffDays} days detected between candles.`,
          date: bar.date
        });
        score -= 1;
      }
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const issueCounts: Record<string, number> = {};
  issues.forEach(iss => {
    issueCounts[iss.type] = (issueCounts[iss.type] || 0) + 1;
  });

  return {
    ticker,
    totalRecords: bars.length,
    qualityScore: score,
    isTrainable: score >= 50,
    issues,
    issueCounts
  };
}
