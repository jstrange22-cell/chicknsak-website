import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import type { LocationPoint } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LiveLocationBadgeProps {
  isTracking: boolean;
  lastLocation: LocationPoint | null;
  error?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeSince(ts: { toDate: () => Date }): string {
  const seconds = Math.floor((Date.now() - ts.toDate().getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function accuracyLabel(meters: number): { text: string; color: string } {
  if (meters <= 10) return { text: 'High', color: 'text-emerald-600' };
  if (meters <= 30) return { text: 'Good', color: 'text-blue-600' };
  if (meters <= 100) return { text: 'Fair', color: 'text-amber-600' };
  return { text: 'Low', color: 'text-red-600' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LiveLocationBadge({ isTracking, lastLocation, error }: LiveLocationBadgeProps) {
  // Re-render every 10s to keep the "time since" label fresh.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isTracking) return;
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, [isTracking]);

  if (!isTracking) return null;

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-red-50 border border-red-200 px-3 py-1.5">
        <MapPin className="h-3.5 w-3.5 text-red-500" />
        <span className="text-xs font-medium text-red-600">{error}</span>
      </div>
    );
  }

  // Tracking, awaiting first position
  if (!lastLocation) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
        </span>
        <span className="text-xs font-medium text-blue-700">Acquiring location...</span>
      </div>
    );
  }

  // Active tracking with a known position
  const accuracy = accuracyLabel(lastLocation.accuracy);

  return (
    <div className="flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5">
      {/* Pulsing green dot */}
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </span>

      <span className="text-xs font-medium text-emerald-700">
        Tracking location
      </span>

      {/* Separator */}
      <span className="h-3 w-px bg-emerald-200" />

      {/* Last update */}
      <span className="text-xs text-emerald-600">
        {formatTimeSince(lastLocation.timestamp)}
      </span>

      {/* Accuracy */}
      <span className={`text-xs font-medium ${accuracy.color}`}>
        {accuracy.text}
      </span>
    </div>
  );
}
