import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PredictionBadgeProps {
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  className?: string;
}

export default function PredictionBadge({ direction, className = '' }: PredictionBadgeProps) {
  const styles = {
    UP: {
      bg: 'bg-accent-green/15',
      text: 'text-accent-green',
      icon: TrendingUp,
      label: 'UP',
    },
    DOWN: {
      bg: 'bg-accent-red/15',
      text: 'text-accent-red',
      icon: TrendingDown,
      label: 'DOWN',
    },
    NEUTRAL: {
      bg: 'bg-accent-yellow/15',
      text: 'text-accent-yellow',
      icon: Minus,
      label: 'NEUTRAL',
    },
  };

  const current = styles[direction] || styles.NEUTRAL;
  const Icon = current.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-xs font-semibold ${current.bg} ${current.text} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {current.label}
    </span>
  );
}
