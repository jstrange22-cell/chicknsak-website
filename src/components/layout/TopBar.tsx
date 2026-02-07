import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, User, HardHat } from 'lucide-react';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useUnreadCount } from '@/hooks/useNotifications';
import { cn, getInitials } from '@/lib/utils';

const pageTitles: Record<string, string> = {
  '/': 'Home',
  '/projects': 'Projects',
  '/camera': 'Camera',
  '/my-stuff': 'My Stuff',
  '/messages': 'Messages',
  '/timeclock': 'Timeclock',
  '/notifications': 'Notifications',
  '/search': 'Search',
  '/dashboard': 'Dashboard',
  '/settings': 'Settings',
};

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile } = useAuthContext();
  const { data: unreadCount = 0 } = useUnreadCount(user?.uid);

  const isHome = location.pathname === '/';
  const pageTitle = pageTitles[location.pathname] || 'StructureWorks';

  return (
    <header
      className={cn(
        'sticky top-0 z-40 h-16 transition-colors duration-200',
        isHome
          ? 'bg-slate-900/95 backdrop-blur-md border-b border-slate-800/60'
          : 'bg-white/95 backdrop-blur-md border-b border-slate-200/80'
      )}
    >
      <div className="flex h-full items-center justify-between px-4">
        {/* Left: Logo on home, page title on sub-pages */}
        {isHome ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 shadow-sm shadow-blue-500/30">
              <HardHat className="h-4.5 w-4.5 text-white" strokeWidth={2.2} />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              StructureWorks
            </span>
          </div>
        ) : (
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            {pageTitle}
          </h1>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {/* Notifications Button */}
          <button
            onClick={() => navigate('/notifications')}
            className={cn(
              'relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
              isHome
                ? 'hover:bg-white/10 active:bg-white/20'
                : 'hover:bg-slate-100 active:bg-slate-200'
            )}
            aria-label="Notifications"
          >
            <Bell
              className={cn(
                'h-[22px] w-[22px] transition-colors',
                isHome ? 'text-slate-300' : 'text-slate-600'
              )}
            />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white shadow-sm animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Avatar */}
          <button
            onClick={() => navigate('/settings')}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full transition-all',
              isHome
                ? 'bg-slate-700/60 hover:bg-slate-700 ring-1 ring-slate-600/50'
                : 'bg-slate-100 hover:bg-slate-200 ring-1 ring-slate-200'
            )}
            aria-label="User menu"
          >
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.fullName}
                className="h-9 w-9 rounded-full object-cover ring-1 ring-black/10"
              />
            ) : (
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  isHome
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-500 text-white'
                )}
              >
                {profile?.fullName ? (
                  getInitials(profile.fullName)
                ) : (
                  <User className="h-4.5 w-4.5" />
                )}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
