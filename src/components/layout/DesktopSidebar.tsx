import { NavLink, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Image,
  Users,
  UsersRound,
  FileText,
  ClipboardCheck,
  DollarSign,
  Map,
  Bot,
  Star,
  Briefcase,
  Link2,
  LayoutTemplate,
  MessageCircle,
  MessageSquare,
  PlusCircle,
  Bell,
  Search,
  Shield,
  Clock,
  Settings,
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { cn, getInitials } from '@/lib/utils';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useUnreadCount } from '@/hooks/useNotifications';

// ---------------------------------------------------------------------------
// Navigation Structure (matching CompanyCam sidebar sections)
// ---------------------------------------------------------------------------

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

const baseNavSections: NavSection[] = [
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
];

const adminNavSection: NavSection = {
  title: 'Management',
  items: [
    { icon: Shield, label: 'Admin Panel', path: '/admin' },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DesktopSidebar() {
  const { profile, user } = useAuthContext();
  const navigate = useNavigate();
  const { data: unreadCount = 0 } = useUnreadCount(user?.uid);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Always show admin section — the admin pages themselves handle role checks
  const navSections = useMemo(() => {
    return [...baseNavSections, adminNavSection];
  }, []);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-full w-[220px] flex-col bg-slate-900 text-white">
      {/* ---- Top Bar: Logo + Actions ---- */}
      <div className="flex h-12 items-center justify-between px-3 border-b border-slate-800/60">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2">
          <img
            src="/img/logo-dark.png"
            alt="ProjectWorks"
            className="h-7 w-7 rounded-md object-contain"
          />
        </NavLink>

        {/* Action icons */}
        <div className="flex items-center gap-0.5">
          {/* Create (+) Button */}
          <div className="relative" ref={createMenuRef}>
            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              aria-label="Create new"
            >
              <PlusCircle className="h-5 w-5" />
            </button>

            {showCreateMenu && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                <button
                  onClick={() => {
                    setShowCreateMenu(false);
                    navigate('/projects');
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <MapPin className="h-4 w-4 text-slate-400" />
                  Create Project
                </button>
                <button
                  onClick={() => {
                    setShowCreateMenu(false);
                    navigate('/messages');
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Users className="h-4 w-4 text-slate-400" />
                  Invite Users
                </button>
                <button
                  onClick={() => {
                    setShowCreateMenu(false);
                    navigate('/messages');
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <UsersRound className="h-4 w-4 text-slate-400" />
                  New User Group
                </button>
              </div>
            )}
          </div>

          {/* Notifications */}
          <button
            onClick={() => navigate('/notifications')}
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Avatar */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex h-8 w-8 items-center justify-center rounded-full overflow-hidden"
              aria-label="User menu"
            >
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-xs font-semibold text-white">
                  {profile?.fullName ? getInitials(profile.fullName) : '?'}
                </span>
              )}
            </button>

            {showUserMenu && (
              <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-50">
                <button
                  onClick={() => { setShowUserMenu(false); navigate('/camera'); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Image className="h-4 w-4 text-slate-400" />
                  My Photos
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); navigate('/settings?tab=profile'); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Users className="h-4 w-4 text-slate-400" />
                  My Settings
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); navigate('/notifications'); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Bell className="h-4 w-4 text-slate-400" />
                  Notification Settings
                </button>

                <div className="border-t border-slate-100 my-1" />
                <p className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Your Company</p>
                <button
                  onClick={() => { setShowUserMenu(false); navigate('/settings?tab=company'); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Company Settings
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); navigate('/settings?tab=tags'); }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Tags
                </button>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Search ---- */}
      <div className="px-3 py-2">
        <button
          onClick={() => navigate('/search')}
          className="flex items-center gap-2 w-full h-8 px-2.5 rounded-md bg-slate-800/60 text-slate-400 text-sm hover:bg-slate-800 transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search</span>
        </button>
      </div>

      {/* ---- Navigation Sections ---- */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="px-3 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.label}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && item.badge > 0 ? (
                      <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-red-300">
                        {item.badge}
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* ---- Bottom: Chat ---- */}
      <div className="border-t border-slate-800/60 p-3 space-y-2">
        <button
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-[13px] text-slate-400 hover:bg-slate-800/60 hover:text-white transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          Chat with Support
        </button>
      </div>
    </aside>
  );
}
