import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Clock,
  Users,
  FolderKanban,
  FileText,
  BarChart3,
  ArrowLeft,
  Shield,
  CalendarDays,
  HardHat,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/components/auth/AuthProvider';

// ---------------------------------------------------------------------------
// Admin Tab Navigation
// ---------------------------------------------------------------------------

interface AdminTab {
  icon: React.ElementType;
  label: string;
  path: string;
}

const adminTabs: AdminTab[] = [
  { icon: Clock, label: 'Timeclock', path: '/admin/timeclock' },
  { icon: Users, label: 'Users', path: '/admin/users' },
  { icon: FolderKanban, label: 'Projects', path: '/admin/projects' },
  { icon: HardHat, label: 'Vendors', path: '/admin/vendors' },
  { icon: FileText, label: 'Invoicing', path: '/admin/invoicing' },
  { icon: BarChart3, label: 'Reports', path: '/admin/reports' },
  { icon: CalendarDays, label: 'Scheduling', path: '/admin/scheduling' },
  { icon: MessageCircle, label: 'Messages', path: '/admin/messages' },
];

// ---------------------------------------------------------------------------
// AdminLayout Component
// ---------------------------------------------------------------------------

export default function AdminLayout() {
  const { profile } = useAuthContext();
  const navigate = useNavigate();

  // Role gate: admin and manager only
  // Also allow if profile hasn't loaded yet (Firebase offline) or if no role is set
  // (legacy users who created the account are treated as admins)
  const isAllowed =
    profile?.role === 'admin' ||
    profile?.role === 'manager' ||
    !profile?.role; // Legacy users without a role assigned are treated as admin

  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Shield className="h-12 w-12 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-700">Access Denied</h2>
        <p className="text-sm text-slate-500">
          You need admin or manager permissions to access the Admin Panel.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to App
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Admin Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-slate-900">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="h-5 w-px bg-slate-700" />
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-400" />
              <h1 className="text-base font-semibold text-white">Admin Panel</h1>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 overflow-x-auto scrollbar-none">
          {adminTabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === '/admin/timeclock'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-blue-400 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600',
                )
              }
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Page Content */}
      <div className="p-4 sm:p-6">
        <Outlet />
      </div>
    </div>
  );
}
