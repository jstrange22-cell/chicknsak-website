import { useState, useEffect, useCallback, useRef } from 'react';
import { syncManager } from '@/lib/offline/syncManager';

const POLL_INTERVAL_MS = 5000;
const SYNC_MESSAGE_CLEAR_DELAY_MS = 3000;

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [pendingActions, setPendingActions] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const messageTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const updateCounts = useCallback(async () => {
    const counts = await syncManager.getPendingCounts();
    setPendingPhotos(counts.photos);
    setPendingActions(counts.actions);
  }, []);

  const syncNow = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;

    setIsSyncing(true);
    setSyncMessage('Starting sync...');

    // Clear any pending message timer
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }

    try {
      const result = await syncManager.processQueue((msg) =>
        setSyncMessage(msg)
      );

      const totalProcessed =
        result.photosProcessed + result.actionsProcessed;

      setSyncMessage(
        totalProcessed > 0
          ? `Synced ${result.photosProcessed} photo${result.photosProcessed !== 1 ? 's' : ''}, ${result.actionsProcessed} action${result.actionsProcessed !== 1 ? 's' : ''}`
          : ''
      );

      // Refresh counts after sync completes
      await updateCounts();
    } catch {
      setSyncMessage('Sync failed');
    } finally {
      setIsSyncing(false);

      // Clear sync message after a short delay
      messageTimerRef.current = setTimeout(
        () => setSyncMessage(''),
        SYNC_MESSAGE_CLEAR_DELAY_MS
      );
    }
  }, [isSyncing, updateCounts]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when connectivity is restored
      syncNow();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncNow]);

  // Poll pending counts on an interval
  useEffect(() => {
    updateCounts();
    const interval = setInterval(updateCounts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [updateCounts]);

  // Clean up message timer on unmount
  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  const totalPending = pendingPhotos + pendingActions;

  return {
    isOnline,
    isSyncing,
    pendingPhotos,
    pendingActions,
    totalPending,
    syncMessage,
    syncNow,
  } as const;
}
