'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
}

export default function LoadingSpinner({
  size = 'md',
  fullPage = false,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4',
  };

  const spinner = (
    <div
      className={`rounded-full border-accent-blue/10 border-t-accent-blue animate-spin ${sizeClasses[size]}`}
      role="status"
      aria-label="Loading"
    />
  );

  if (fullPage) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center bg-bg-primary transition-theme">
        {spinner}
      </div>
    );
  }

  return <div className="flex items-center justify-center p-4">{spinner}</div>;
}
