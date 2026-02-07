import { NavLink } from 'react-router-dom';
import {
  Home,
  FolderOpen,
  Clock,
  ClipboardCheck,
  HardHat,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  isCenter?: boolean;
}

const mainNavItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: FolderOpen, label: 'Projects', path: '/projects' },
  { icon: HardHat, label: 'JobMate', path: '/ai-chat', isCenter: true },
  { icon: Clock, label: 'Timeclock', path: '/timeclock' },
  { icon: ClipboardCheck, label: 'Checklists', path: '/checklists' },
];

export function MobileBottomNav({ unreadCount: _unreadCount = 0 }: { unreadCount?: number }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 safe-area-inset-bottom">
      {/* Top edge glow */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
      <div className="absolute inset-x-0 -top-3 h-3 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none" />

      <div className="h-[4.5rem] bg-slate-900 border-t border-slate-800/80">
        <div className="flex h-full items-center justify-around px-1">
          {mainNavItems.map((item) => {
            // Center button -- prominent raised circle (JobMate)
            if (item.isCenter) {
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="relative flex flex-col items-center justify-center min-w-[64px] -mt-4"
                >
                  {({ isActive }) => (
                    <>
                      {/* Outer glow ring */}
                      <div className="absolute -top-[18px] h-[68px] w-[68px] rounded-full bg-amber-500/20 blur-md pointer-events-none" />
                      {/* Main button */}
                      <div
                        className={cn(
                          'relative flex h-[60px] w-[60px] items-center justify-center rounded-full shadow-lg shadow-amber-500/40 transition-all duration-200 active:scale-95',
                          isActive
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600 ring-2 ring-amber-400/50'
                            : 'bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500'
                        )}
                      >
                        <item.icon className="h-7 w-7 text-white" strokeWidth={2.2} />
                      </div>
                      <span className="mt-1 text-[11px] font-medium text-amber-400">
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              );
            }

            // Standard nav items
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center gap-1 min-w-[64px] h-full active:opacity-70 transition-opacity"
              >
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <item.icon
                        className={cn(
                          'h-6 w-6 transition-colors duration-200',
                          isActive ? 'text-blue-400' : 'text-slate-400'
                        )}
                      />
                      {/* Active indicator dot */}
                      {isActive && (
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-400" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-[11px] font-medium transition-colors duration-200',
                        isActive ? 'text-blue-400' : 'text-slate-500'
                      )}
                    >
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
