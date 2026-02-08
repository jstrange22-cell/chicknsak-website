import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
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

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    if (needRefresh) {
      const timer = setTimeout(() => {
        setNeedRefresh(false);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [needRefresh, setNeedRefresh]);

  if (!needRefresh) return null;

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
          onClick={() => setNeedRefresh(false)}
          className="shrink-0 p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
}
