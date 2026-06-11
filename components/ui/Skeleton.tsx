'use client';

export function Skeleton({ 
  className = '', 
  variant = 'text' 
}: { 
  className?: string; 
  variant?: 'text' | 'circular' | 'rectangular';
}) {
  const baseClasses = "relative overflow-hidden bg-divider-custom/40 rounded-xl before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-text-muted/5 before:to-transparent";
  
  const variantClasses = {
    text: 'h-4 w-3/4 rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  return <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />;
}

export function StockCardSkeleton() {
  return (
    <div className="p-5 border border-border-custom bg-bg-card rounded-2xl space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
      <div className="flex justify-between items-end pt-2">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3.5 w-12" />
        </div>
        <Skeleton className="h-7 w-20" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 w-full animate-reveal">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Sidebar Watchlist Skeleton */}
        <aside className="md:col-span-3 border border-border-custom bg-bg-card p-4.5 rounded-2xl space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-8" />
          </div>
          <div className="space-y-3 pt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-divider-custom/40 last:border-0">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </aside>

        {/* Main Panel Skeleton */}
        <section className="md:col-span-9 space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 border border-border-custom bg-bg-card rounded-2xl space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-5 w-full mt-2" />
                </div>
              ))}
            </div>
          </div>

          <div className="py-2">
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
              <StockCardSkeleton />
              <StockCardSkeleton />
              <StockCardSkeleton />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export function StockAnalysisSkeleton() {
  return (
    <div className="space-y-6 w-full animate-reveal">
      {/* Breadcrumb Skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-16" />
      </div>

      {/* Header Info Block Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 border border-border-custom bg-bg-card rounded-2xl">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4.5 w-48" />
        </div>
        <div className="space-y-2 text-right self-stretch md:self-auto flex md:block justify-between items-center">
          <Skeleton className="h-8 w-24 ml-auto" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-6">
          {/* Prediction Card */}
          <div className="p-5 border border-border-custom bg-bg-card rounded-2xl space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-12 w-full mt-2" />
            <Skeleton className="h-16 w-full mt-2" />
          </div>

          {/* Chart Card */}
          <div className="p-5 border border-border-custom bg-bg-card rounded-2xl space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-64" />
            </div>
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>

        {/* Sidebar Summary Area */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-5 border border-border-custom bg-bg-card rounded-2xl space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex justify-between items-center py-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-5 border border-border-custom bg-bg-card rounded-2xl space-y-4">
            <Skeleton className="h-5 w-40" />
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
