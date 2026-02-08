import { useEffect, useRef, useCallback, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

const DISMISS_KEY = 'pwa-update-dismissed';

export function ReloadPrompt() {
  // Tracks whether the initial SW registration has completed.
  // Any needRefresh that fires before this flag is set came from a
  // waiting worker that was already present on page load -- we
  // auto-update silently for that case instead of showing a banner.
  const initialLoadDone = useRef(false);

  // Whether the banner should be visible to the user.
  // We manage this separately from needRefresh so we can suppress
  // the banner on initial load and after sessionStorage dismissal.
  const showBanner = useRef(false);
  // Force a re-render when showBanner changes.
  const [, setRenderTick] = useState(0);
  const forceRender = useCallback(() => setRenderTick((t) => t + 1), []);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Mark the initial registration as complete.  Any update
      // detected *after* this point is a "live" update that should
      // show the banner.  We use a small delay so the very first
      // needRefresh (from a pre-existing waiting worker) has time
      // to fire before we flip the flag.
      setTimeout(() => {
        initialLoadDone.current = true;
      }, 1500);

      // Check for updates every 60 seconds
      if (registration) {
        setInterval(() => {
          void registration.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
  });

  // React to needRefresh changes -- decide whether to show the
  // banner or auto-update silently.
  useEffect(() => {
    if (!needRefresh) {
      showBanner.current = false;
      forceRender();
      return;
    }

    // --- Initial-load update: auto-apply silently ---
    if (!initialLoadDone.current) {
      void updateServiceWorker(true);
      return;
    }

    // --- User previously dismissed during this session ---
    if (sessionStorage.getItem(DISMISS_KEY)) {
      setNeedRefresh(false);
      return;
    }

    // --- Live update while user is active: show the banner ---
    showBanner.current = true;
    forceRender();
  }, [needRefresh, setNeedRefresh, updateServiceWorker, forceRender]);

  // Auto-dismiss after 15 seconds (persists dismissal to sessionStorage)
  useEffect(() => {
    if (showBanner.current && needRefresh) {
      const timer = setTimeout(() => {
        sessionStorage.setItem(DISMISS_KEY, '1');
        setNeedRefresh(false);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [needRefresh, setNeedRefresh]);

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  if (!showBanner.current || !needRefresh) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-[100] animate-in slide-in-from-bottom duration-300">
      <div className="bg-slate-900 text-white rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3">
        <RefreshCw className="h-5 w-5 shrink-0 text-blue-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Update available</p>
          <p className="text-xs text-slate-400">Tap to get the latest version</p>
        </div>
        <button
          onClick={() => void updateServiceWorker(true)}
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500 transition-colors"
        >
          Update
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
}
