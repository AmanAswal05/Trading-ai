import { RefreshCw } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <RefreshCw className="w-8 h-8 text-accent-primary animate-spin mb-4" />
      <p className="text-text-secondary font-medium">Loading Admin Console...</p>
    </div>
  );
}
