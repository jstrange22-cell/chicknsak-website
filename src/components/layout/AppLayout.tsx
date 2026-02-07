import { Outlet } from 'react-router-dom';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { DesktopSidebar } from './DesktopSidebar';
import { InstallPrompt } from './InstallPrompt';
import { OfflineBanner } from './OfflineBanner';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export function AppLayout() {
  const isDesktop = useMediaQuery('(min-width: 768px)');

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
          <TopBar />
          <main className="pb-20 overscroll-contain">
            <Outlet />
          </main>
          <MobileBottomNav />
        </>
      )}
    </div>
  );
}
