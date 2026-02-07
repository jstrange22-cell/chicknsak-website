import { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { cn } from '@/lib/utils';

type BannerState = 'hidden' | 'offline' | 'syncing' | 'success';

const SUCCESS_DISPLAY_MS = 2500;

export function OfflineBanner() {
  const {
    isOnline,
    isSyncing,
    totalPending,
    syncMessage,
    syncNow,
  } = useOfflineSync();

  const [showSuccess, setShowSuccess] = useState(false);
  const [prevSyncing, setPrevSyncing] = useState(false);

  // Track when sync completes to show success flash
  useEffect(() => {
    if (prevSyncing && !isSyncing && isOnline) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), SUCCESS_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
    setPrevSyncing(isSyncing);
  }, [isSyncing, isOnline, prevSyncing]);

  const bannerState: BannerState = !isOnline
    ? 'offline'
    : isSyncing
      ? 'syncing'
      : showSuccess
        ? 'success'
        : totalPending > 0
          ? 'offline' // Show pending items count even when online
          : 'hidden';

  const isVisible = bannerState !== 'hidden';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed left-0 right-0 z-50 transform transition-all duration-300 ease-in-out',
        // Position below the sticky TopBar (h-14 = 3.5rem)
        'top-14',
        // Desktop layout offset for sidebar (pl-60)
        'md:left-60',
        isVisible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium shadow-sm',
          bannerState === 'offline' && 'bg-amber-50 text-amber-800 border-b border-amber-200',
          bannerState === 'syncing' && 'bg-blue-50 text-blue-800 border-b border-blue-200',
          bannerState === 'success' && 'bg-green-50 text-green-800 border-b border-green-200'
        )}
      >
        {/* Left: Icon + Message */}
        <div className="flex items-center gap-2 min-w-0">
          {bannerState === 'offline' && (
            <>
              <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="truncate">
                {!isOnline
                  ? "You're offline — changes will sync when connected"
                  : `${totalPending} pending item${totalPending !== 1 ? 's' : ''} to sync`}
              </span>
            </>
          )}

          {bannerState === 'syncing' && (
            <>
              <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
              <span className="truncate">
                Syncing{syncMessage ? ` — ${syncMessage}` : '...'}
              </span>
            </>
          )}

          {bannerState === 'success' && (
            <>
              <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
              <span className="truncate">Synced successfully</span>
            </>
          )}
        </div>

        {/* Right: Manual Sync Button (shown when offline with pending items, or online with pending) */}
        {bannerState === 'offline' && isOnline && totalPending > 0 && (
          <button
            type="button"
            onClick={syncNow}
            className={cn(
              'shrink-0 rounded-md px-3 py-1 text-xs font-semibold transition-colors',
              'bg-amber-200 text-amber-900 hover:bg-amber-300 active:bg-amber-400'
            )}
          >
            Sync now
          </button>
        )}

        {/* Right: Pending count badge when offline */}
        {bannerState === 'offline' && !isOnline && totalPending > 0 && (
          <span
            className={cn(
              'shrink-0 flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold',
              'bg-amber-200 text-amber-900'
            )}
          >
            {totalPending}
          </span>
        )}

        {/* Right: Online indicator when syncing */}
        {bannerState === 'syncing' && (
          <Wifi className="h-4 w-4 shrink-0 text-blue-400" />
        )}
      </div>
    </div>
  );
}
