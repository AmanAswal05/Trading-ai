export type MarketDataSource = 'Stooq' | 'Yahoo' | 'Alpha Vantage' | 'Mock';

export interface OHLCVData {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
  source: MarketDataSource;
}

export interface FetchOptions {
  ticker: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  preferredSource?: 'AUTO' | 'STOOQ' | 'YAHOO' | 'ALPHA_VANTAGE';
}
