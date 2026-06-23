/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useMemo } from 'react';
import { HistoricalQuote } from '@/types/stock';
import { RSI, MACD, BollingerBands } from 'technicalindicators';
import { useCurrency } from '@/lib/currency-context';
import { formatDate } from '@/lib/format';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

interface IndicatorPanelProps {
  history: HistoricalQuote[];
}

type TabType = 'RSI' | 'MACD' | 'BB';

export default function IndicatorPanel({ history }: IndicatorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('RSI');
  const { convert, symbol, currency } = useCurrency();
  const decimalPlaces = currency === 'JPY' ? 0 : 2;

  const formatConvertedPrice = (val: number) => {
    return `${symbol}${val.toLocaleString(undefined, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    })}`;
  };

  // Sort history ascending (oldest first)
  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [history]);

  const closes = useMemo(() => sortedHistory.map((h) => h.close), [sortedHistory]);

  // 1. Calculate RSI historical series
  const rsiData = useMemo(() => {
    const rsiVals = RSI.calculate({ values: closes, period: 14 });
    const offset = sortedHistory.length - rsiVals.length;
    return sortedHistory.map((item, idx) => {
      const rsiIdx = idx - offset;
      return {
        date: item.date,
        rsi: rsiIdx >= 0 ? Number(rsiVals[rsiIdx].toFixed(2)) : null,
      };
    });
  }, [sortedHistory, closes]);

  // 2. Calculate MACD historical series
  const macdData = useMemo(() => {
    if (closes.length < 26) return [];
    const macdVals = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const offset = sortedHistory.length - macdVals.length;
    return sortedHistory.map((item, idx) => {
      const mIdx = idx - offset;
      const val = mIdx >= 0 ? macdVals[mIdx] : null;
      return {
        date: item.date,
        macd: val ? Number((val.MACD || 0).toFixed(2)) : null,
        signal: val ? Number((val.signal || 0).toFixed(2)) : null,
        histogram: val ? Number((val.histogram || 0).toFixed(2)) : null,
      };
    });
  }, [sortedHistory, closes]);

  // 3. Calculate Bollinger Bands historical series (USD base)
  const bbData = useMemo(() => {
    if (closes.length < 20) return [];
    const bbVals = BollingerBands.calculate({
      values: closes,
      period: 20,
      stdDev: 2,
    });
    const offset = sortedHistory.length - bbVals.length;
    return sortedHistory.map((item, idx) => {
      const bIdx = idx - offset;
      const val = bIdx >= 0 ? bbVals[bIdx] : null;
      return {
        date: item.date,
        close: item.close,
        upper: val ? Number((val.upper || 0).toFixed(2)) : null,
        middle: val ? Number((val.middle || 0).toFixed(2)) : null,
        lower: val ? Number((val.lower || 0).toFixed(2)) : null,
      };
    });
  }, [sortedHistory, closes]);

  // Memoize converted BB data (scaled to active currency)
  const convertedBbData = useMemo(() => {
    return bbData.map((item) => ({
      ...item,
      close: convert(item.close),
      upper: item.upper !== null ? convert(item.upper) : null,
      middle: item.middle !== null ? convert(item.middle) : null,
      lower: item.lower !== null ? convert(item.lower) : null,
    }));
  }, [bbData, convert]);

  const XAxisComponent = (
    <XAxis
      dataKey="date"
      tickFormatter={(str) => {
        try {
          const date = new Date(str);
          return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch {
          return str;
        }
      }}
      stroke="var(--text-muted)"
      fontSize={9}
      fontFamily="JetBrains Mono"
      tickLine={false}
      axisLine={false}
    />
  );

  return (
    <div className="p-4.5 rounded-xl border border-border-custom bg-bg-card transition-theme">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Technical Indicator Analytics</h3>
          <p className="text-xs text-text-secondary">Select indicators to overlay historical graphs</p>
        </div>
        <div className="flex bg-bg-secondary p-1 rounded-xl border border-border-custom transition-theme">
          {(['RSI', 'MACD', 'BB'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === tab
                  ? 'bg-bg-card text-accent-blue shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab === 'BB' ? 'Bollinger Bands' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Panel */}
      <div className="h-64 sm:h-72 w-full">
        {activeTab === 'RSI' && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rsiData} margin={{ top: 10, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              {XAxisComponent}
              <YAxis
                domain={[0, 100]}
                ticks={[0, 30, 50, 70, 100]}
                stroke="var(--text-muted)"
                fontSize={9}
                fontFamily="JetBrains Mono"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length > 0) {
                    const item = payload[0].payload;
                    return (
                      <div className="p-3 border border-border-custom bg-bg-card rounded-xl shadow-lg text-xs font-mono">
                        <p className="text-text-primary font-bold mb-1">{formatDate(item.date)}</p>
                        <p className="text-accent-blue">RSI (14): <span className="font-bold">{item.rsi}</span></p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine y={70} stroke="var(--accent-red)" strokeDasharray="3 3" strokeWidth={1} />
              <ReferenceLine y={30} stroke="var(--accent-green)" strokeDasharray="3 3" strokeWidth={1} />
              <Line
                type="monotone"
                dataKey="rsi"
                stroke="var(--accent-blue)"
                strokeWidth={1.75}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'MACD' && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={macdData} margin={{ top: 10, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              {XAxisComponent}
              <YAxis stroke="var(--text-muted)" fontSize={9} fontFamily="JetBrains Mono" tickLine={false} axisLine={false} />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length > 0) {
                    const item = payload[0].payload;
                    return (
                      <div className="p-3 border border-border-custom bg-bg-card rounded-xl shadow-lg text-xs font-mono leading-relaxed">
                        <p className="text-text-primary font-bold mb-1">{formatDate(item.date)}</p>
                        <p className="text-accent-blue">MACD: <span className="font-semibold">{item.macd}</span></p>
                        <p className="text-accent-yellow">Signal: <span className="font-semibold">{item.signal}</span></p>
                        <p className={item.histogram >= 0 ? 'text-accent-green' : 'text-accent-red'}>
                          Hist: <span className="font-semibold">{item.histogram}</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="histogram">
                {macdData.map((entry: any, index: number) => {
                  const fill = (entry.histogram || 0) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
                  return <rect key={`bar-${index}`} fill={fill} fillOpacity={0.4} />;
                })}
              </Bar>
              <Line type="monotone" dataKey="macd" stroke="var(--accent-blue)" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="signal" stroke="var(--accent-yellow)" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'BB' && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={convertedBbData} margin={{ top: 10, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
              {XAxisComponent}
              <YAxis
                tickFormatter={(val) => formatConvertedPrice(val)}
                stroke="var(--text-muted)"
                fontSize={9}
                fontFamily="JetBrains Mono"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length > 0) {
                    const item = payload[0].payload;
                    return (
                      <div className="p-3 border border-border-custom bg-bg-card rounded-xl shadow-lg text-xs font-mono leading-relaxed">
                        <p className="text-text-primary font-bold mb-1.5">{formatDate(item.date)}</p>
                        <p className="text-text-primary font-semibold">Price: {formatConvertedPrice(item.close)}</p>
                        {item.upper !== null && <p className="text-accent-blue">Upper Band: {formatConvertedPrice(item.upper)}</p>}
                        {item.middle !== null && <p className="text-text-secondary">Middle Band: {formatConvertedPrice(item.middle)}</p>}
                        {item.lower !== null && <p className="text-accent-blue">Lower Band: {formatConvertedPrice(item.lower)}</p>}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line type="monotone" dataKey="upper" stroke="var(--accent-blue)" strokeWidth={1} strokeDasharray="3 3" dot={false} />
              <Line type="monotone" dataKey="middle" stroke="var(--text-muted)" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="lower" stroke="var(--accent-blue)" strokeWidth={1} strokeDasharray="3 3" dot={false} />
              <Line type="monotone" dataKey="close" stroke="var(--text-primary)" strokeWidth={1.75} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
