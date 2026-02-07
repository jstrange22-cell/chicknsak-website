import { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Square, MapPin, MapPinOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveEntry, useClockIn, useClockOut } from '@/hooks/useTimeEntries';
import { useProjects } from '@/hooks/useProjects';
import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Running Timer Display
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function useElapsedSeconds(clockInTime: Timestamp | undefined): number {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!clockInTime) {
      setElapsed(0);
      return;
    }

    const clockInDate = clockInTime.toDate();

    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - clockInDate.getTime()) / 1000));
      setElapsed(diff);
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [clockInTime]);

  return elapsed;
}

// ---------------------------------------------------------------------------
// GPS Status Badge
// ---------------------------------------------------------------------------

function GPSStatus({ isActive }: { isActive: boolean }) {
  const [status, setStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => setStatus('available'),
      () => setStatus('unavailable'),
      { timeout: 5000 },
    );
  }, [isActive]);

  if (status === 'checking') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Checking GPS...</span>
      </div>
    );
  }

  if (status === 'available') {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600">
        <MapPin className="h-3 w-3" />
        <span>GPS Available</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-600">
      <MapPinOff className="h-3 w-3" />
      <span>GPS Unavailable</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClockInOut Component
// ---------------------------------------------------------------------------

export function ClockInOut() {
  const { data: activeEntry, isLoading: isLoadingEntry } = useActiveEntry();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { data: projects } = useProjects({ status: 'active' });

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const isClockedIn = !!activeEntry;
  const elapsed = useElapsedSeconds(activeEntry?.clockInTime);
  const isBusy = clockIn.isPending || clockOut.isPending;

  // Sync project selector with active entry's project
  useEffect(() => {
    if (activeEntry?.projectId) {
      setSelectedProjectId(activeEntry.projectId);
    }
  }, [activeEntry?.projectId]);

  const activeProjectName = useMemo(() => {
    if (!activeEntry?.projectId || !projects) return null;
    const p = projects.find((proj) => proj.id === activeEntry.projectId);
    return p?.name ?? null;
  }, [activeEntry?.projectId, projects]);

  const handleClockIn = async () => {
    try {
      await clockIn.mutateAsync({
        projectId: selectedProjectId || undefined,
      });
    } catch (err) {
      console.error('Clock in failed:', err);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    try {
      await clockOut.mutateAsync({
        entryId: activeEntry.id,
        clockInTime: activeEntry.clockInTime,
        breakMinutes: activeEntry.breakMinutes,
      });
    } catch (err) {
      console.error('Clock out failed:', err);
    }
  };

  if (isLoadingEntry) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {/* Timer Display (only when clocked in) */}
      {isClockedIn && (
        <div className="text-center">
          <p className="text-4xl font-mono font-bold text-slate-900 tabular-nums tracking-tight">
            {formatElapsed(elapsed)}
          </p>
          {activeProjectName && (
            <p className="mt-1 text-sm text-slate-500">{activeProjectName}</p>
          )}
        </div>
      )}

      {/* Main Button */}
      <button
        onClick={isClockedIn ? handleClockOut : handleClockIn}
        disabled={isBusy}
        className={cn(
          'flex items-center justify-center rounded-full transition-all duration-200',
          'h-[100px] w-[100px] shadow-lg active:scale-95',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2',
          isClockedIn
            ? 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-300 text-white'
            : 'bg-emerald-500 hover:bg-emerald-600 focus-visible:ring-emerald-300 text-white',
          isBusy && 'opacity-70 cursor-not-allowed',
        )}
      >
        {isBusy ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : isClockedIn ? (
          <Square className="h-10 w-10" />
        ) : (
          <Play className="h-10 w-10 ml-1" />
        )}
      </button>

      <p className="text-sm font-medium text-slate-600">
        {isBusy
          ? 'Processing...'
          : isClockedIn
            ? 'Tap to Clock Out'
            : 'Tap to Clock In'}
      </p>

      {/* Project Selector (only when NOT clocked in) */}
      {!isClockedIn && (
        <div className="w-full max-w-xs">
          <label htmlFor="project-select" className="block text-xs font-medium text-slate-500 mb-1">
            Project (optional)
          </label>
          <select
            id="project-select"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <option value="">No project</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* GPS Indicator */}
      <GPSStatus isActive={isClockedIn} />

      {/* Error messages */}
      {clockIn.isError && (
        <p className="text-sm text-red-500">
          Failed to clock in. Please try again.
        </p>
      )}
      {clockOut.isError && (
        <p className="text-sm text-red-500">
          Failed to clock out. Please try again.
        </p>
      )}
    </div>
  );
}
