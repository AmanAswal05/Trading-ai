/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { HistoricalQuote } from '@/types/stock';
import { formatVolume, formatDate } from '@/lib/format';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';

interface VolumeChartProps {
  data: HistoricalQuote[];
}

export default function VolumeChart({ data }: VolumeChartProps) {
  return (
    <div className="w-full h-32 sm:h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
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
            fontSize={9}
            fontFamily="JetBrains Mono"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(val) => formatVolume(val)}
            stroke="var(--text-muted)"
            fontSize={9}
            fontFamily="JetBrains Mono"
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }: any) => {
              if (active && payload && payload.length > 0) {
                const item: HistoricalQuote = payload[0].payload;
                const isUp = item.close >= item.open;
                return (
                  <div className="p-3 border border-border-custom bg-bg-card rounded-xl shadow-lg text-xs font-mono transition-theme leading-relaxed">
                    <p className="text-text-primary font-bold mb-1">{formatDate(item.date)}</p>
                    <div className="flex gap-2 items-center">
                      <span className="text-text-secondary">Volume:</span>
                      <span className={`font-bold ${isUp ? 'text-accent-green' : 'text-accent-red'}`}>
                        {item.volume.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
            cursor={{ fill: 'var(--bg-card-hover)', opacity: 0.1 }}
          />
          <Bar dataKey="volume">
            {data.map((entry, index) => {
              const isUp = entry.close >= entry.open;
              const fill = isUp ? 'var(--chart-bullish)' : 'var(--chart-bearish)';
              return <Cell key={`cell-${index}`} fill={fill} fillOpacity={0.35} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
