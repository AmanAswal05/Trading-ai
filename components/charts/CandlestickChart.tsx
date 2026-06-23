/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import { useMemo } from 'react';
import { useCurrency } from '@/lib/currency-context';
import { HistoricalQuote } from '@/types/stock';
import { formatDate } from '@/lib/format';
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  CartesianGrid,
} from 'recharts';

interface CandlestickChartProps {
  data: HistoricalQuote[];
}

const Candlestick = (props: any) => {
  const { x, y, width, height, payload, yScale } = props;
  if (!payload || !yScale) return null;

  const { open, close, high, low } = payload;
  const isUp = close >= open;
  
  // Clean theme-aware color mapping
  const color = isUp ? 'var(--chart-bullish)' : 'var(--chart-bearish)';
  const center = x + width / 2;

  const yHigh = yScale(high);
  const yLow = yScale(low);
  
  // Recharts Y coordinate is inverted (0 is top)
  const yTop = Math.min(yScale(open), yScale(close));
  const yBottom = Math.max(yScale(open), yScale(close));
  const candleHeight = Math.max(1, yBottom - yTop);

  return (
    <g>
      {/* Wick */}
      <line
        x1={center}
        y1={yHigh}
        x2={center}
        y2={yLow}
        stroke={color}
        strokeWidth={1.5}
      />
      {/* Body */}
      <rect
        x={x}
        y={yTop}
        width={width}
        height={candleHeight}
        fill={color}
        stroke={color}
        strokeWidth={1}
        className="transition-all duration-300"
      />
    </g>
  );
};

export default function CandlestickChart({ data }: CandlestickChartProps) {
  const { convert, symbol, currency } = useCurrency();
  const decimalPlaces = currency === 'JPY' ? 0 : 2;

  // Validate the data integrity before processing
  const isValidData = useMemo(() => {
    if (!data || data.length === 0) return false;
    
    let previousTime = 0;
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      // Basic presence checks
      if (d.open == null || d.high == null || d.low == null || d.close == null || d.date == null) return false;
      
      // Impossible candle checks
      if (d.high < d.low) return false;
      if (d.close > d.high || d.close < d.low) return false;
      if (d.open > d.high || d.open < d.low) return false;
      
      // Timestamp checks
      const time = new Date(d.date).getTime();
      if (isNaN(time)) return false;
      if (i > 0 && time <= previousTime) return false; // Not sorted or duplicate
      previousTime = time;
    }
    return true;
  }, [data]);

  // Memoize converted data to optimize performance
  const convertedData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      open: convert(d.open),
      high: convert(d.high),
      low: convert(d.low),
      close: convert(d.close),
    }));
  }, [data, convert]);

  if (!isValidData) {
    return (
      <div className="w-full h-80 sm:h-96 flex flex-col items-center justify-center border border-dashed border-border-custom bg-bg-secondary/10 rounded-xl text-text-secondary text-sm">
        <svg className="w-8 h-8 mb-3 text-accent-red/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>Data Validation Failed</span>
        <span className="text-xs text-text-muted mt-1">Unable to render accurate chart</span>
      </div>
    );
  }

  const formatConvertedPrice = (val: number) => {
    return `${symbol}${val.toLocaleString(undefined, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    })}`;
  };



  // Find min/max values to fit charts perfectly
  const lows = convertedData.map((d) => d.low);
  const highs = convertedData.map((d) => d.high);
  const minVal = Math.min(...lows) * 0.98;
  const maxVal = Math.max(...highs) * 1.02;

  return (
    <div className="w-full h-80 sm:h-96">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={convertedData} margin={{ top: 10, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
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
            fontSize={10}
            fontFamily="JetBrains Mono"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[minVal, maxVal]}
            tickFormatter={(val) => formatConvertedPrice(val)}
            stroke="var(--text-muted)"
            fontSize={10}
            fontFamily="JetBrains Mono"
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }: any) => {
              if (active && payload && payload.length > 0) {
                const item: HistoricalQuote = payload[0].payload;
                return (
                  <div className="p-3.5 border border-border-custom bg-bg-card rounded-xl shadow-lg text-xs font-mono transition-theme leading-relaxed">
                    <p className="text-text-primary font-bold mb-1.5">{formatDate(item.date)}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <span className="text-text-secondary">Open:</span>
                      <span className="text-text-primary font-semibold text-right">{formatConvertedPrice(item.open)}</span>
                      <span className="text-text-secondary">High:</span>
                      <span className="text-accent-green font-semibold text-right">{formatConvertedPrice(item.high)}</span>
                      <span className="text-text-secondary">Low:</span>
                      <span className="text-accent-red font-semibold text-right">{formatConvertedPrice(item.low)}</span>
                      <span className="text-text-secondary">Close:</span>
                      <span className="text-text-primary font-bold text-right">{formatConvertedPrice(item.close)}</span>
                      <span className="text-text-secondary">Volume:</span>
                      <span className="text-text-muted text-right">{item.volume.toLocaleString()}</span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
            cursor={{ fill: 'var(--bg-card-hover)', opacity: 0.1 }}
          />
          {/* We pass a dummy dataKey, but our shape uses the full payload details */}
          <Bar dataKey="close" fill="transparent" shape={<Candlestick />} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
