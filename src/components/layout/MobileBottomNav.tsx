import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  FolderOpen,
  Camera,
  ClipboardList,
  Menu,
  X,
  MessageSquare,
  Clock,
  LayoutDashboard,
  Settings,
  LogOut,
  CreditCard,
  ChevronRight,
  Bot,
  ClipboardCheck,
  FileText,
  Map,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/components/auth/AuthProvider';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  isCenter?: boolean;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: FolderOpen, label: 'Projects', path: '/projects' },
  { icon: Camera, label: 'Camera', path: '/camera', isCenter: true },
  { icon: ClipboardList, label: 'My Stuff', path: '/my-stuff' },
  { icon: Menu, label: 'More', path: '#more' },
];

const moreMenuItems: NavItem[] = [
  { icon: MessageSquare, label: 'Messages', path: '/messages' },
  { icon: Clock, label: 'Timeclock', path: '/timeclock' },
  { icon: ClipboardCheck, label: 'Checklists', path: '/checklists' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: CreditCard, label: 'Payments', path: '/payments' },
  { icon: Map, label: 'Map', path: '/map' },
  { icon: Bot, label: 'JobMate', path: '/ai-chat' },
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function MobileBottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { signOut } = useAuthContext();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    setIsMoreOpen(false);
    await signOut();
    navigate('/auth/login');
  };

  // Inject badge count into Messages item
  const moreItems = moreMenuItems.map((item) =>
    item.path === '/messages' ? { ...item, badge: unreadCount } : item
  );

  return (
    <>
      {/* More Menu Overlay */}
      {isMoreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsMoreOpen(false)}
        />
      )}

      {/* More Menu Sheet */}
      <div
        className={cn(
          'fixed bottom-[4.5rem] left-0 right-0 z-50 transform bg-white rounded-t-3xl shadow-2xl transition-all duration-300 ease-out safe-area-inset-bottom',
          isMoreOpen
            ? 'translate-y-0 opacity-100'
            : 'translate-y-full opacity-0 pointer-events-none'
        )}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <div className="px-5 pb-6 pt-2 max-h-[calc(100vh-6rem)] overflow-y-auto overscroll-contain">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              More
            </h2>
            <button
              onClick={() => setIsMoreOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 transition-colors"
            >
              <X className="h-4 w-4 text-slate-600" />
            </button>
          </div>

          <nav className="space-y-0.5">
            {moreItems.map((item, index) => (
              <div key={item.path}>
                <NavLink
                  to={item.path}
                  onClick={() => setIsMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3.5 rounded-xl px-3.5 py-3.5 text-sm font-medium transition-all active:scale-[0.98]',
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                          isActive
                            ? 'bg-blue-100 text-blue-600'
                            : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="flex-1 text-[15px]">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-2 text-[11px] font-bold text-white shadow-sm shadow-red-500/30">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      )}
                    </>
                  )}
                </NavLink>
                {index < moreItems.length - 1 && (
                  <div className="mx-3.5 ml-[3.75rem] border-b border-slate-100" />
                )}
              </div>
            ))}

            {/* Divider before Sign Out */}
            <div className="mx-3 border-b border-slate-200 !my-2" />

            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3.5 text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100 active:scale-[0.98] transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500">
                <LogOut className="h-5 w-5" />
              </div>
              <span className="text-[15px]">Sign Out</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 safe-area-inset-bottom">
        {/* Top edge glow */}
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        <div className="absolute inset-x-0 -top-3 h-3 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none" />

        <div className="h-[4.5rem] bg-slate-900 border-t border-slate-800/80">
          <div className="flex h-full items-center justify-around px-1">
            {mainNavItems.map((item) => {
              // "More" button
              if (item.path === '#more') {
                return (
                  <button
                    key={item.path}
                    onClick={() => setIsMoreOpen(!isMoreOpen)}
                    className="flex flex-col items-center justify-center gap-1 min-w-[64px] h-full relative active:opacity-70 transition-opacity"
                  >
                    <div className="relative">
                      <item.icon
                        className={cn(
                          'h-6 w-6 transition-colors duration-200',
                          isMoreOpen ? 'text-blue-400' : 'text-slate-400'
                        )}
                      />
                      {/* Badge on More button for unread messages */}
                      {unreadCount > 0 && (
                        <span className="absolute -right-2.5 -top-1.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-slate-900 shadow-sm shadow-red-500/40">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-[11px] font-medium transition-colors duration-200',
                        isMoreOpen ? 'text-blue-400' : 'text-slate-500'
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              }

              // Camera button -- prominent raised circle
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
                        <div className="absolute -top-[18px] h-[68px] w-[68px] rounded-full bg-blue-500/20 blur-md pointer-events-none" />
                        {/* Main camera button */}
                        <div
                          className={cn(
                            'relative flex h-[60px] w-[60px] items-center justify-center rounded-full shadow-lg shadow-blue-500/40 transition-all duration-200 active:scale-95',
                            isActive
                              ? 'bg-blue-500 ring-2 ring-blue-400/50'
                              : 'bg-blue-500 hover:bg-blue-400'
                          )}
                        >
                          <Camera className="h-7 w-7 text-white" strokeWidth={2.2} />
                        </div>
                        <span className="mt-1 text-[11px] font-medium text-blue-400">
                          Camera
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
    </>
  );
}
