import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileSidebar } from './MobileSidebar';
import { DesktopSidebar } from './DesktopSidebar';
import { InstallPrompt } from './InstallPrompt';
import { OfflineBanner } from './OfflineBanner';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useMessageNotifications } from '@/hooks/useMessageNotifications';

export function AppLayout() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuthContext();
  const { data: unreadCount = 0 } = useUnreadCount(user?.uid);

  // Global message notification watcher — shows browser notifications
  // for new messages across all channels (no FCM/Cloud Functions needed)
  useMessageNotifications();

  // Auto-request notification permission on first use
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      // Small delay so the app loads first
      const timer = setTimeout(() => {
        Notification.requestPermission().catch(() => {/* ignore */});
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden max-w-[100vw]">
      <OfflineBanner />
      <InstallPrompt />
      {isDesktop ? (
        <>
          {/* Desktop Layout - CompanyCam style: sidebar only, no top bar */}
          <DesktopSidebar />
          <div className="pl-[220px]">
            <main className="p-6">
              <Outlet />
            </main>
          </div>
        </>
      ) : (
        <>
          {/* Mobile Layout */}
          <TopBar onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
          <MobileSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            unreadCount={unreadCount}
          />
          <main className="pb-20 overscroll-contain">
            <Outlet />
          </main>
          <MobileBottomNav unreadCount={unreadCount} />
        </>
      )}
    </div>
  );
}
