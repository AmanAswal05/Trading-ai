import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi } from 'lightweight-charts';
import { OHLCVBar, BacktestTrade } from '../../lib/backtesting/types';

interface CandlestickChartProps {
  data: OHLCVBar[];
  trades: BacktestTrade[];
}

export default function CandlestickChart({ data, trades }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const currentContainer = chartContainerRef.current;

    // Safely remove existing chart if any to prevent duplicates in strict mode
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {
        console.warn('Error removing existing chart:', e);
      }
      chartRef.current = null;
    }

    const chart = createChart(currentContainer, {
      layout: {
        background: { color: 'transparent' } as any,
        textColor: '#A3A3A3',
      },
      grid: {
        vertLines: { color: '#262626' },
        horzLines: { color: '#262626' },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: '#262626',
      },
      timeScale: {
        borderColor: '#262626',
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const chartData = data.map(d => ({
      time: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));
    
    candlestickSeries.setData(chartData);

    // Markers
    const markers: any[] = [];
    
    trades.forEach(trade => {
      // Entry Marker
      markers.push({
        time: trade.date,
        position: trade.direction === 'UP' ? 'belowBar' : 'aboveBar',
        color: trade.direction === 'UP' ? '#3b82f6' : '#a855f7',
        shape: trade.direction === 'UP' ? 'arrowUp' : 'arrowDown',
        text: `Entry: ${trade.entryPrice.toFixed(2)}`,
      });

      // Exit Marker
      markers.push({
        time: trade.exitDate,
        position: trade.isWin ? 'aboveBar' : 'belowBar',
        color: trade.isWin ? '#22c55e' : '#ef4444',
        shape: trade.isWin ? 'arrowDown' : 'arrowUp',
        text: `Exit: ${trade.exitPrice.toFixed(2)} (${trade.returnPct > 0 ? '+' : ''}${trade.returnPct.toFixed(2)}%)`,
      });
    });

    // Sort markers by time
    markers.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    candlestickSeries.setMarkers(markers);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (currentContainer && chartRef.current) {
        try {
          chartRef.current.applyOptions({ width: currentContainer.clientWidth });
        } catch (e) {
          console.warn('Resize error on disposed chart:', e);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          console.warn('Error during chart cleanup:', e);
        }
        chartRef.current = null;
      }
    };
  }, [data, trades]);

  return <div ref={chartContainerRef} className="w-full h-96" />;
}
