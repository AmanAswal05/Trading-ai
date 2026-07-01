import { getStockDataInternal } from './stock-service';

export type MarketRegime = 'STRONG_BULL' | 'BULL' | 'NEUTRAL' | 'BEAR' | 'STRONG_BEAR';

export interface RegimeData {
  regime: MarketRegime;
  vix: number;
}

export async function detectMarketRegime(market: 'US' | 'INDIA'): Promise<RegimeData> {
  const index1Ticker = market === 'US' ? 'SPY' : '^NSEI';
  const index2Ticker = market === 'US' ? 'QQQ' : '^NSEBANK';
  const vixTicker = market === 'US' ? '^VIX' : '^INDIAVIX';

  try {
    const [index1Data, index2Data, vixData] = await Promise.all([
      getStockDataInternal(index1Ticker),
      getStockDataInternal(index2Ticker),
      getStockDataInternal(vixTicker)
    ]);

    if (!index1Data || !index2Data || !vixData || !index1Data.indicators || !index2Data.indicators) {
      return { regime: 'NEUTRAL', vix: 0 };
    }

    const vixLevel = vixData.quote.price;

    const checkStrongBull = (data: any) => 
      data.quote.price > data.indicators.ema20 && 
      data.quote.price > data.indicators.ema50 && 
      data.indicators.ema20 > data.indicators.ema50;

    const checkStrongBear = (data: any) => 
      data.quote.price < data.indicators.ema20 && 
      data.quote.price < data.indicators.ema50;

    const checkBull = (data: any) => data.quote.price > data.indicators.ema50;
    const checkBear = (data: any) => data.quote.price < data.indicators.ema50;

    const i1StrongBull = checkStrongBull(index1Data);
    const i2StrongBull = checkStrongBull(index2Data);
    const i1StrongBear = checkStrongBear(index1Data);
    const i2StrongBear = checkStrongBear(index2Data);
    const i1Bull = checkBull(index1Data);
    const i2Bull = checkBull(index2Data);
    const i1Bear = checkBear(index1Data);
    const i2Bear = checkBear(index2Data);

    let regime: MarketRegime = 'NEUTRAL';

    if (i1StrongBull && i2StrongBull && vixLevel < 15) {
      regime = 'STRONG_BULL';
    } else if (i1StrongBear && i2StrongBear && vixLevel > 25) {
      regime = 'STRONG_BEAR';
    } else if (i1Bull && i2Bull && vixLevel < 18) {
      regime = 'BULL';
    } else if (i1Bear && i2Bear && vixLevel > 20) {
      regime = 'BEAR';
    }

    return { regime, vix: Number(vixLevel.toFixed(2)) };
  } catch (error) {
    console.error(`Failed to detect market regime for ${market}:`, error);
    return { regime: 'NEUTRAL', vix: 0 };
  }
}
