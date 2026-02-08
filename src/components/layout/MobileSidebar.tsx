import { NavLink, useNavigate } from 'react-router-dom';
import {
  X,
  MapPin,
  Image,
  MessageSquare,
  Clock,
  FileText,
  ClipboardCheck,
  DollarSign,
  Map,
  Star,
  Briefcase,
  Bot,
  Link2,
  LayoutTemplate,
  Settings,
  Shield,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/components/auth/AuthProvider';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'PROJECTWORKS',
    items: [
      { icon: MapPin, label: 'Projects', path: '/projects' },
      { icon: Image, label: 'Photos', path: '/camera' },
      { icon: MessageSquare, label: 'Messages', path: '/messages' },
      { icon: Clock, label: 'Timeclock', path: '/timeclock' },
      { icon: FileText, label: 'Reports', path: '/reports' },
      { icon: ClipboardCheck, label: 'Checklists', path: '/checklists' },
      { icon: DollarSign, label: 'Payments', path: '/payments' },
      { icon: Map, label: 'Map', path: '/map' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { icon: Star, label: 'Reviews', path: '/reviews' },
      { icon: Briefcase, label: 'Portfolio', path: '/portfolio' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { icon: Bot, label: 'JobMate', path: '/ai-chat' },
      { icon: Link2, label: 'Integrations', path: '/integrations' },
      { icon: LayoutTemplate, label: 'Templates', path: '/templates' },
      { icon: Settings, label: 'Settings', path: '/settings' },
    ],
  },
  {
    title: 'Management',
    items: [
      { icon: Shield, label: 'Admin Panel', path: '/admin' },
    ],
  },
];

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  unreadCount?: number;
}

export function MobileSidebar({ isOpen, onClose, unreadCount = 0 }: MobileSidebarProps) {
  const { signOut, profile } = useAuthContext();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    onClose();
    await signOut();
    navigate('/auth/login');
  };

  // Inject badge on Messages
  const sections = navSections.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.path === '/messages' ? { ...item, badge: unreadCount } : item
    ),
  }));

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div
        className={cn(
          'fixed top-0 left-0 z-[70] h-full w-[280px] bg-slate-900 text-white transform transition-transform duration-300 ease-out shadow-2xl',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header: Logo + Close */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800/60">
          <NavLink to="/" onClick={onClose} className="flex items-center gap-2">
            <img
              src="/img/logo-dark.png"
              alt="ProjectWorks"
              className="h-9 w-9 rounded-lg object-contain"
            />
            <span className="text-lg font-bold tracking-tight text-white">
              ProjectWorks
            </span>
          </NavLink>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10 active:bg-white/20 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* User Profile Section */}
        {profile && (
          <div className="px-4 py-3 border-b border-slate-800/60">
            <div className="flex items-center gap-3">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-700"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white ring-2 ring-slate-700">
                  {profile.fullName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {profile.fullName || 'User'}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {profile.role || 'Team Member'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4" style={{ maxHeight: 'calc(100vh - 10rem)' }}>
          {sections.map((section) => (
            <div key={section.title}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors active:scale-[0.98]',
                          isActive
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                        )
                      }
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : null}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom: Sign Out */}
        <div className="border-t border-slate-800/60 p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium text-red-400 hover:bg-red-500/10 active:bg-red-500/20 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
}
