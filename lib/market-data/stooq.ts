import { OHLCVData, FetchOptions } from './types';

export async function fetchFromStooq({ ticker, startDate, endDate }: FetchOptions): Promise<OHLCVData[]> {
  const d1 = startDate.replace(/-/g, '');
  const d2 = endDate.replace(/-/g, '');
  // Append .us for US stocks, might need robust logic later
  const symbol = `${ticker.toLowerCase()}.us`;
  const url = `https://stooq.com/q/d/l/?s=${symbol}&d1=${d1}&d2=${d2}&i=d`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Stooq API returned status ${res.status}`);
    }

    const text = await res.text();
    if (text.includes('No data') || text.includes('Exceeded the daily')) {
      throw new Error(`Stooq API returned no valid data for ${ticker}`);
    }

    const lines = text.trim().split('\n');
    if (lines.length <= 1) {
      throw new Error(`Stooq returned empty data for ${ticker}`);
    }

    const data: OHLCVData[] = [];
    // CSV format: Date,Open,High,Low,Close,Volume
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 6) {
        const [dateStr, open, high, low, close, volume] = parts;
        // Basic validation
        if (dateStr && open && high && low && close && volume) {
          data.push({
            date: dateStr,
            open: parseFloat(open),
            high: parseFloat(high),
            low: parseFloat(low),
            close: parseFloat(close),
            volume: parseFloat(volume) || 0,
            source: 'Stooq',
          });
        }
      }
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
