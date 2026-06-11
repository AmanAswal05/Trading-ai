'use client';

interface ConfidenceGaugeProps {
  confidence: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  size?: number;
  strokeWidth?: number;
}

export default function ConfidenceGauge({
  confidence,
  direction,
  size = 120,
  strokeWidth = 10,
}: ConfidenceGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (confidence / 100) * circumference;

  let strokeColor = 'var(--bearish-red)';
  if (confidence >= 70) {
    strokeColor = 'var(--success)';
  } else if (confidence >= 50) {
    strokeColor = 'var(--warning)';
  }

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          className="transition-theme"
        />
        {/* Value circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Percentage Text overlay */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="font-mono text-2xl font-bold text-text-primary">
          {confidence}%
        </span>
        <span className="text-[10px] text-text-secondary uppercase font-semibold tracking-wider">
          Confidence
        </span>
      </div>
    </div>
  );
}
