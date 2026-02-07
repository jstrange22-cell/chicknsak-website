import { useState } from 'react';
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

export function AppLayout() {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuthContext();
  const { data: unreadCount = 0 } = useUnreadCount(user?.uid);

  return (
    <div className="min-h-screen bg-slate-50">
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
