'use client';

import { useId } from 'react';

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
}

export default function Sparkline({
  points,
  width = 120,
  height = 36,
  strokeWidth = 1.5,
}: SparklineProps) {
  const uniqueId = useId();

  if (!points || points.length < 2) {
    return (
      <svg width={width} height={height} className="text-text-muted">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="currentColor" strokeWidth={strokeWidth} strokeDasharray="3 3" />
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  // Map values to coordinates
  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    // Invert Y axis for SVG rendering
    const y = height - ((val - min) / range) * height;
    return { x, y };
  });

  const pathD = `M ${coords.map((c) => `${c.x},${c.y}`).join(' L ')}`;
  
  // Determine if overall trend is positive
  const first = points[0];
  const last = points[points.length - 1];
  const isPositive = last >= first;
  const strokeColor = isPositive ? 'var(--accent-green)' : 'var(--accent-red)';
  
  // Unique ID for gradient to avoid clashes (stable across SSR and hydration)
  const gradId = `spark-grad-${uniqueId.replace(/:/g, '')}`;
  
  // Path for fill area under the line
  const fillD = `${pathD} L ${width},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.12" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      
      {/* Fill Area */}
      <path d={fillD} fill={`url(#${gradId})`} />
      
      {/* Line Path */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
