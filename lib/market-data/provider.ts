import { OHLCVData, FetchOptions } from './types';
import { fetchFromStooq } from './stooq';
import { fetchFromYahoo } from './yahoo';
import { fetchFromAlphaVantage } from './alpha-vantage';

// Maps common user tickers to source-specific formats
function mapTicker(ticker: string, source: 'STOOQ' | 'YAHOO' | 'ALPHA_VANTAGE'): string {
  const t = ticker.toUpperCase();
  
  if (source === 'YAHOO') {
    if (t === 'NIFTY') return '^NSEI';
    if (t === 'RELIANCE.BSE') return 'RELIANCE.BO';
    if (t === 'RELIANCE.NS' || t === 'RELIANCE') return 'RELIANCE.NS';
    return t;
  }
  
  if (source === 'STOOQ') {
    if (t === 'NIFTY') return '^SNX';
    if (t === 'RELIANCE.BSE' || t === 'RELIANCE.NS' || t === 'RELIANCE') return 'RELIANCE.IN';
    // Stooq requires .US for US stocks usually, but fetchFromStooq handles .US suffix for letters-only
    return t;
  }
  
  if (source === 'ALPHA_VANTAGE') {
    if (t === 'NIFTY') return 'BSE:SENSEX'; // AV is limited for Indian index
    if (t === 'RELIANCE.BSE') return 'BSE:RELIANCE';
    if (t === 'RELIANCE.NS' || t === 'RELIANCE') return 'NSE:RELIANCE';
    return t;
  }

  return t;
}

export async function fetchMarketData(options: FetchOptions): Promise<{ data: OHLCVData[], source: string, logs: string[] }> {
  const logs: string[] = [];
  const pref = options.preferredSource || 'AUTO';

  const trySource = async (source: 'STOOQ' | 'YAHOO' | 'ALPHA_VANTAGE', fetcher: (o: FetchOptions) => Promise<OHLCVData[]>) => {
    try {
      const mappedTicker = mapTicker(options.ticker, source);
      const data = await fetcher({ ...options, ticker: mappedTicker });
      if (data.length > 50) {
        logs.push(`Successfully fetched from ${source} (${mappedTicker})`);
        return { data, source, logs };
      } else {
        logs.push(`${source} returned empty data for ${mappedTicker}`);
      }
    } catch (error: any) {
      logs.push(`${source} failed: ${error.message}`);
    }
    return null;
  };

  // If specific source is requested
  if (pref === 'STOOQ') {
    const res = await trySource('STOOQ', fetchFromStooq);
    if (res) return res;
  } else if (pref === 'YAHOO') {
    const res = await trySource('YAHOO', fetchFromYahoo);
    if (res) return res;
  } else if (pref === 'ALPHA_VANTAGE') {
    if (!process.env.ALPHA_VANTAGE_API_KEY) throw new Error("ALPHA_VANTAGE_API_KEY is not defined in environment.");
    const res = await trySource('ALPHA_VANTAGE', fetchFromAlphaVantage);
    if (res) return res;
  }

  // If Auto or specific source failed, fallback sequentially
  if (pref !== 'STOOQ') {
    const resStooq = await trySource('STOOQ', fetchFromStooq);
    if (resStooq) return resStooq;
  }
  
  if (pref !== 'YAHOO') {
    const resYahoo = await trySource('YAHOO', fetchFromYahoo);
    if (resYahoo) return resYahoo;
  }
  
  if (pref !== 'ALPHA_VANTAGE' && process.env.ALPHA_VANTAGE_API_KEY) {
    const resAv = await trySource('ALPHA_VANTAGE', fetchFromAlphaVantage);
    if (resAv) return resAv;
  }

  throw new Error(`No historical data source available. Try another ticker or source. Logs: ${logs.join(' | ')}`);
}
