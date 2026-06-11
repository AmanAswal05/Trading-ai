'use client';

import { useCurrency } from '@/lib/currency-context';
import { TechnicalIndicators } from '@/types/stock';

interface TechnicalSummaryProps {
  currentPrice: number;
  indicators: TechnicalIndicators;
}

interface IndicatorSignal {
  name: string;
  value: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  reason: string;
}

export default function TechnicalSummary({ currentPrice, indicators }: TechnicalSummaryProps) {
  const { formatPrice } = useCurrency();
  const {
    rsi14,
    macd,
    sma20,
    sma50,
    sma200,
    ema12,
    ema26,
    bollingerUpper,
    bollingerMiddle,
    bollingerLower,
    stochasticK,
    stochasticD,
    williamsR,
    obv,
  } = indicators;

  // Signal calculations based on industry standard rules
  const list: IndicatorSignal[] = [
    {
      name: 'RSI (14)',
      value: rsi14.toString(),
      signal: rsi14 > 70 ? 'SELL' : rsi14 < 30 ? 'BUY' : 'NEUTRAL',
      reason: rsi14 > 70 ? 'Overbought (>70)' : rsi14 < 30 ? 'Oversold (<30)' : 'Neutral Momentum',
    },
    {
      name: 'MACD (12, 26)',
      value: `MACD: ${macd.macd} | Sig: ${macd.signal}`,
      signal: macd.histogram > 0 ? 'BUY' : macd.histogram < 0 ? 'SELL' : 'NEUTRAL',
      reason: macd.histogram > 0 ? 'Bullish Crossover' : macd.histogram < 0 ? 'Bearish Crossover' : 'Consolidating',
    },
    {
      name: 'Bollinger Bands (20, 2)',
      value: `Mid: ${formatPrice(bollingerMiddle)}`,
      signal: currentPrice > bollingerUpper ? 'SELL' : currentPrice < bollingerLower ? 'BUY' : 'NEUTRAL',
      reason: currentPrice > bollingerUpper ? 'Above Upper Band' : currentPrice < bollingerLower ? 'Below Lower Band' : 'Inside Bands',
    },
    {
      name: 'Stochastic Oscillator',
      value: `%K: ${stochasticK} | %D: ${stochasticD}`,
      signal:
        stochasticK > stochasticD && stochasticK < 20
          ? 'BUY'
          : stochasticK < stochasticD && stochasticK > 80
          ? 'SELL'
          : 'NEUTRAL',
      reason:
        stochasticK > stochasticD && stochasticK < 20
          ? 'Bullish oversold cross'
          : stochasticK < stochasticD && stochasticK > 80
          ? 'Bearish overbought cross'
          : 'No cross in extremes',
    },
    {
      name: 'Williams %R (14)',
      value: williamsR.toString(),
      signal: williamsR > -20 ? 'SELL' : williamsR < -80 ? 'BUY' : 'NEUTRAL',
      reason: williamsR > -20 ? 'Overbought (>-20)' : williamsR < -80 ? 'Oversold (<-80)' : 'Neutral range',
    },
    {
      name: 'Simple Moving Average (20)',
      value: formatPrice(sma20),
      signal: currentPrice > sma20 ? 'BUY' : 'SELL',
      reason: currentPrice > sma20 ? 'Price above SMA 20' : 'Price below SMA 20',
    },
    {
      name: 'Simple Moving Average (50)',
      value: formatPrice(sma50),
      signal: currentPrice > sma50 ? 'BUY' : 'SELL',
      reason: currentPrice > sma50 ? 'Price above SMA 50' : 'Price below SMA 50',
    },
    {
      name: 'Simple Moving Average (200)',
      value: formatPrice(sma200),
      signal: currentPrice > sma200 ? 'BUY' : 'SELL',
      reason: currentPrice > sma200 ? 'Price above SMA 200' : 'Price below SMA 200',
    },
    {
      name: 'Exponential Moving Average (12)',
      value: formatPrice(ema12),
      signal: currentPrice > ema12 ? 'BUY' : 'SELL',
      reason: currentPrice > ema12 ? 'Price above EMA 12' : 'Price below EMA 12',
    },
    {
      name: 'Exponential Moving Average (26)',
      value: formatPrice(ema26),
      signal: currentPrice > ema26 ? 'BUY' : 'SELL',
      reason: currentPrice > ema26 ? 'Price above EMA 26' : 'Price below EMA 26',
    },
    {
      name: 'On-Balance Volume (OBV)',
      value: obv.toLocaleString(),
      signal: 'NEUTRAL',
      reason: 'Volume accumulation trend',
    },
  ];

  const badgeStyles = {
    BUY: 'bg-accent-green/12 text-accent-green border-accent-green/30',
    SELL: 'bg-accent-red/12 text-accent-red border-accent-red/30',
    NEUTRAL: 'bg-accent-yellow/12 text-accent-yellow border-accent-yellow/30',
  };

  return (
    <div className="p-5 border border-border-custom bg-bg-card rounded-xl transition-theme">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-text-primary">Technical Summary Indicator Signals</h3>
        <p className="text-xs text-text-secondary">Summary analysis of key momentum and trend variables</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-border-custom text-text-muted font-bold font-sans">
              <th className="py-2.5 pb-2">INDICATOR</th>
              <th className="py-2.5 pb-2">VALUE</th>
              <th className="py-2.5 pb-2 text-center">SIGNAL</th>
              <th className="py-2.5 pb-2 pl-4 hidden sm:table-cell">TECHNICAL VIEW</th>
            </tr>
          </thead>
          <tbody className="font-mono text-text-secondary">
            {list.map((row) => (
              <tr
                key={row.name}
                className="border-b border-border-custom/55 last:border-0 hover:bg-table-row-hover transition-colors"
              >
                <td className="py-3 font-sans font-semibold text-text-primary pr-2">{row.name}</td>
                <td className="py-3">{row.value}</td>
                <td className="py-3 text-center">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded border text-[10px] font-bold tracking-wider leading-none ${
                      badgeStyles[row.signal]
                    }`}
                  >
                    {row.signal}
                  </span>
                </td>
                <td className="py-3 pl-4 font-sans text-text-muted hidden sm:table-cell">{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
