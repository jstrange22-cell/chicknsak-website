import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// PWA Update Detection & Reload Prompt
// ---------------------------------------------------------------------------
// This component:
// 1. Registers the service worker properly
// 2. Checks for updates every 60 seconds
// 3. Shows a banner when a new version is available
// 4. Lets the user click "Update" to activate the new SW and reload
// ---------------------------------------------------------------------------

export function ReloadPrompt() {
  const [showReload, setShowReload] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function registerSW() {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // If there's already a waiting worker (update downloaded before this page loaded)
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setShowReload(true);
        }

        // Listen for new service worker installing
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            // New SW is installed and waiting to activate
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setShowReload(true);
            }
          });
        });

        // Check for updates every 60 seconds
        intervalId = setInterval(() => {
          void reg.update();
        }, 60 * 1000);

        // Also check immediately on visibility change (user comes back to tab/app)
        function onVisibilityChange() {
          if (document.visibilityState === 'visible') {
            void reg.update();
          }
        }
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
          document.removeEventListener('visibilitychange', onVisibilityChange);
        };
      } catch (err) {
        console.error('SW registration failed:', err);
      }
    }

    // Listen for controller change (fires when a new SW takes over, whether
    // triggered by this tab or another tab). Set this up *before* calling
    // registerSW so we never miss the event.
    let refreshing = false;
    function onControllerChange() {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    void registerSW();

    // Also check via navigator.serviceWorker.ready — if a SW is already
    // controlling the page and has a waiting worker we haven't seen yet
    // (e.g. the page was hard-refreshed), surface the banner.
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setShowReload(true);
      }
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      // Tell the waiting SW to skip waiting and become active
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      setShowReload(false);

      // Fallback: force reload after 1.5s if controllerchange doesn't fire.
      // The controllerchange listener (set up in the useEffect) will reload
      // immediately if it fires, and its `refreshing` guard prevents a double
      // reload. But on some mobile browsers / edge cases the event never
      // arrives, so this timeout guarantees the update still lands.
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  const handleDismiss = () => {
    setShowReload(false);
  };

  if (!showReload) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-in slide-in-from-top duration-300">
      <div className="bg-blue-600 text-white px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 shrink-0 animate-spin-slow" />
            <div>
              <p className="text-sm font-semibold">Update Available</p>
              <p className="text-xs text-blue-200">A new version of ProjectWorks is ready.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpdate}
              className="rounded-lg bg-white text-blue-600 px-4 py-1.5 text-sm font-semibold hover:bg-blue-50 transition-colors"
            >
              Update Now
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
