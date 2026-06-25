import { OHLCVData, FetchOptions } from './types';

export async function fetchFromAlphaVantage({ ticker, startDate, endDate }: FetchOptions): Promise<OHLCVData[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error('ALPHA_VANTAGE_API_KEY is not defined');
  }

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=full&apikey=${apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Alpha Vantage API returned status ${res.status}`);
    }

    const json = await res.json();
    
    if (json['Error Message']) {
        throw new Error(`Alpha Vantage Error: ${json['Error Message']}`);
    }
    
    if (json['Note']) {
        throw new Error(`Alpha Vantage Rate Limit: ${json['Note']}`);
    }

    const timeSeries = json['Time Series (Daily)'];
    if (!timeSeries) {
      throw new Error(`Alpha Vantage returned invalid data for ${ticker}`);
    }

    const bars: OHLCVData[] = [];
    const dates = Object.keys(timeSeries).sort((a, b) => a.localeCompare(b));

    for (const date of dates) {
      if (date >= startDate && date <= endDate) {
        const dayData = timeSeries[date];
        bars.push({
          date: date,
          open: parseFloat(dayData['1. open']),
          high: parseFloat(dayData['2. high']),
          low: parseFloat(dayData['3. low']),
          close: parseFloat(dayData['4. close']),
          volume: parseFloat(dayData['5. volume']),
          source: 'Alpha Vantage',
        });
      }
    }

    if (bars.length === 0) {
        throw new Error(`No data found in date range for ${ticker}`);
    }

    return bars;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
