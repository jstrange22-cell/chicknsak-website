import { useState, useRef, useCallback, useEffect } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/firebase';
import type { LocationPoint } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocationTrackingState {
  isTracking: boolean;
  lastLocation: LocationPoint | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of points to collect before flushing to Firestore. */
const BATCH_SIZE = 5;

/** Interval (ms) when tab is visible / foregrounded. */
const FOREGROUND_INTERVAL_MS = 30_000;

/** Interval (ms) when tab is hidden / backgrounded. */
const BACKGROUND_INTERVAL_MS = 120_000;

// ---------------------------------------------------------------------------
// Hook – useLocationTracking
// ---------------------------------------------------------------------------

export function useLocationTracking() {
  const [state, setState] = useState<LocationTrackingState>({
    isTracking: false,
    lastLocation: null,
    error: null,
  });

  // Refs that persist across renders without triggering re-renders.
  const watchIdRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const entryIdRef = useRef<string | null>(null);
  const bufferRef = useRef<LocationPoint[]>([]);
  const isFlushing = useRef(false);

  // -----------------------------------------------------------------------
  // Flush batched location points to Firestore
  // -----------------------------------------------------------------------

  const flushBuffer = useCallback(async () => {
    const entryId = entryIdRef.current;
    if (!entryId || bufferRef.current.length === 0 || isFlushing.current) return;

    isFlushing.current = true;
    const toWrite = [...bufferRef.current];
    bufferRef.current = [];

    try {
      const colRef = collection(db, 'timeEntries', entryId, 'locationHistory');
      // Write each point as its own document in the subcollection.
      await Promise.all(
        toWrite.map((point) =>
          addDoc(colRef, {
            latitude: point.latitude,
            longitude: point.longitude,
            accuracy: point.accuracy,
            timestamp: point.timestamp,
            ...(point.speed != null ? { speed: point.speed } : {}),
          }),
        ),
      );
    } catch (err) {
      // If the write fails, push points back so they can be retried.
      bufferRef.current = [...toWrite, ...bufferRef.current];
      console.error('Failed to flush location buffer:', err);
    } finally {
      isFlushing.current = false;
    }
  }, []);

  // -----------------------------------------------------------------------
  // Record a single position into the buffer
  // -----------------------------------------------------------------------

  const recordPosition = useCallback(
    (pos: GeolocationPosition) => {
      const point: LocationPoint = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: Timestamp.fromDate(new Date(pos.timestamp)),
        ...(pos.coords.speed != null ? { speed: pos.coords.speed } : {}),
      };

      bufferRef.current.push(point);
      setState((prev) => ({ ...prev, lastLocation: point, error: null }));

      if (bufferRef.current.length >= BATCH_SIZE) {
        void flushBuffer();
      }
    },
    [flushBuffer],
  );

  // -----------------------------------------------------------------------
  // Handle geolocation errors
  // -----------------------------------------------------------------------

  const handleError = useCallback((err: GeolocationPositionError) => {
    let message = 'Location error';
    if (err.code === err.PERMISSION_DENIED) {
      message = 'Location permission denied';
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      message = 'Position unavailable';
    } else if (err.code === err.TIMEOUT) {
      message = 'Location request timed out';
    }
    setState((prev) => ({ ...prev, error: message }));
  }, []);

  // -----------------------------------------------------------------------
  // Visibility-aware interval management
  // -----------------------------------------------------------------------

  const setupInterval = useCallback(() => {
    // Clear any previous interval.
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const isHidden = document.visibilityState === 'hidden';
    const ms = isHidden ? BACKGROUND_INTERVAL_MS : FOREGROUND_INTERVAL_MS;

    intervalRef.current = setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(recordPosition, handleError, {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      });
    }, ms);
  }, [recordPosition, handleError]);

  // -----------------------------------------------------------------------
  // Start tracking
  // -----------------------------------------------------------------------

  const startTracking = useCallback(
    (entryId: string) => {
      if (!navigator.geolocation) {
        setState((prev) => ({
          ...prev,
          error: 'Geolocation is not supported by this browser',
        }));
        return;
      }

      entryIdRef.current = entryId;
      bufferRef.current = [];

      // Grab an initial position immediately.
      navigator.geolocation.getCurrentPosition(recordPosition, handleError, {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      });

      // Start the recurring interval (visibility-aware).
      setupInterval();

      // Listen for visibility changes to adjust cadence.
      document.addEventListener('visibilitychange', setupInterval);

      setState({ isTracking: true, lastLocation: null, error: null });
    },
    [recordPosition, handleError, setupInterval],
  );

  // -----------------------------------------------------------------------
  // Stop tracking
  // -----------------------------------------------------------------------

  const stopTracking = useCallback(async () => {
    // Clear the watch (if used).
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Clear interval.
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    document.removeEventListener('visibilitychange', setupInterval);

    // Flush remaining points.
    await flushBuffer();

    entryIdRef.current = null;
    setState({ isTracking: false, lastLocation: null, error: null });
  }, [flushBuffer, setupInterval]);

  // -----------------------------------------------------------------------
  // Cleanup on unmount
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', setupInterval);
      // Attempt a final flush.
      void flushBuffer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    startTracking,
    stopTracking,
    isTracking: state.isTracking,
    lastLocation: state.lastLocation,
    error: state.error,
  };
}

// ---------------------------------------------------------------------------
// Hook – useLocationHistory
// ---------------------------------------------------------------------------

/** Fetches all location history points for a given time entry. */
export function useLocationHistory(entryId: string | undefined) {
  return useQuery({
    queryKey: ['locationHistory', entryId],
    queryFn: async (): Promise<LocationPoint[]> => {
      if (!entryId) return [];

      const colRef = collection(db, 'timeEntries', entryId, 'locationHistory');
      const q = query(colRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((d) => d.data() as LocationPoint);
    },
    enabled: !!entryId,
  });
}
