import { useState, useMemo } from 'react';
import {
  Loader2,
  BarChart3,
  FolderKanban,
  Clock,
  Activity,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/utils';
import type { Project, TimeEntry, ActivityLogEntry, User as UserType } from '@/types';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useCompanyProjects(companyId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'reports', 'projects', companyId],
    queryFn: async (): Promise<Project[]> => {
      if (!companyId) return [];
      const q = query(
        collection(db, 'projects'),
        where('companyId', '==', companyId),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
    },
    enabled: !!companyId,
  });
}

function useMonthTimeEntries(companyId: string | undefined, startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['admin', 'reports', 'time', companyId, startDate.toISOString(), endDate.toISOString()],
    queryFn: async (): Promise<TimeEntry[]> => {
      if (!companyId) return [];
      const startTs = Timestamp.fromDate(startDate);
      const endTs = Timestamp.fromDate(endDate);
      const q = query(
        collection(db, 'timeEntries'),
        where('companyId', '==', companyId),
        where('clockInTime', '>=', startTs),
        where('clockInTime', '<=', endTs),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimeEntry));
      data.sort((a, b) => {
        const aTime = (a.clockInTime as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.clockInTime as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return data;
    },
    enabled: !!companyId,
  });
}

function useRecentActivity(companyId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'reports', 'activity', companyId],
    queryFn: async (): Promise<ActivityLogEntry[]> => {
      if (!companyId) return [];
      const q = query(
        collection(db, 'activityLog'),
        where('companyId', '==', companyId),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLogEntry));
      data.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return data.slice(0, 20);
    },
    enabled: !!companyId,
  });
}

function useCompanyMembers(companyId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'reports', 'members', companyId],
    queryFn: async (): Promise<UserType[]> => {
      if (!companyId) return [];
      const q = query(
        collection(db, 'users'),
        where('companyId', '==', companyId),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserType));
    },
    enabled: !!companyId,
  });
}

// ---------------------------------------------------------------------------
// Bar Chart Component (div-based)
// ---------------------------------------------------------------------------

interface BarData {
  label: string;
  value: number;
  color: string;
}

function SimpleBarChart({ data, title }: { data: BarData[]; title: string }) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs text-slate-600 w-24 truncate" title={item.label}>
              {item.label}
            </span>
            <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', item.color)}
                style={{ width: `${Math.max((item.value / maxValue) * 100, 2)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-700 w-12 text-right">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminReports Component
// ---------------------------------------------------------------------------

export default function AdminReports() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  // Date range
  const [rangeMonths, setRangeMonths] = useState(1);
  const dateRange = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setMonth(start.getMonth() - rangeMonths);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }, [rangeMonths]);

  const { data: projects = [], isLoading: projectsLoading } = useCompanyProjects(companyId);
  const { data: timeEntries = [], isLoading: timeLoading } = useMonthTimeEntries(companyId, dateRange.start, dateRange.end);
  const { data: activities = [], isLoading: activityLoading } = useRecentActivity(companyId);
  const { data: members = [] } = useCompanyMembers(companyId);

  const memberMap = useMemo(() => {
    const map: Record<string, string> = {};
    members.forEach((m) => { map[m.id] = m.fullName; });
    return map;
  }, [members]);

  // Project stats
  const projectStats = useMemo(() => {
    const active = projects.filter((p) => p.status === 'active').length;
    const completed = projects.filter((p) => p.status === 'completed').length;
    const archived = projects.filter((p) => p.status === 'archived').length;
    const onHold = projects.filter((p) => p.status === 'on_hold').length;
    return { total: projects.length, active, completed, archived, onHold };
  }, [projects]);

  // Time stats by user
  const timeByUser = useMemo(() => {
    const map: Record<string, number> = {};
    timeEntries.forEach((e) => {
      if (!map[e.userId]) map[e.userId] = 0;
      map[e.userId] += e.durationMinutes ?? 0;
    });
    return Object.entries(map)
      .map(([userId, minutes]) => ({
        label: memberMap[userId] || 'Unknown',
        value: Math.round(minutes / 60 * 10) / 10,
        color: 'bg-blue-500',
      }))
      .sort((a, b) => b.value - a.value);
  }, [timeEntries, memberMap]);

  const totalHours = useMemo(() => {
    const total = timeEntries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
    return Math.round((total / 60) * 100) / 100;
  }, [timeEntries]);

  // Project status chart data
  const projectChartData: BarData[] = useMemo(() => [
    { label: 'Active', value: projectStats.active, color: 'bg-blue-500' },
    { label: 'Completed', value: projectStats.completed, color: 'bg-emerald-500' },
    { label: 'On Hold', value: projectStats.onHold, color: 'bg-amber-500' },
    { label: 'Archived', value: projectStats.archived, color: 'bg-slate-400' },
  ], [projectStats]);

  const isLoading = projectsLoading || timeLoading || activityLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div>
      {/* Date Range Selector */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Company Reports</h2>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {[
            { label: '1 Month', value: 1 },
            { label: '3 Months', value: 3 },
            { label: '6 Months', value: 6 },
            { label: '1 Year', value: 12 },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRangeMonths(opt.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                rangeMonths === opt.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FolderKanban className="h-4 w-4 text-blue-500" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Projects</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{projectStats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FolderKanban className="h-4 w-4 text-emerald-500" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Projects</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{projectStats.active}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-blue-500" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Hours</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalHours}h</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-amber-500" />
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Time Entries</p>
          </div>
          <p className="text-2xl font-bold text-slate-900">{timeEntries.length}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Project Status Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-slate-400" />
            <h3 className="text-base font-semibold text-slate-900">Projects by Status</h3>
          </div>
          <SimpleBarChart data={projectChartData} title="" />
        </div>

        {/* Hours by User Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-slate-400" />
            <h3 className="text-base font-semibold text-slate-900">Hours by Team Member</h3>
          </div>
          {timeByUser.length > 0 ? (
            <SimpleBarChart data={timeByUser} title="" />
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">No time entries in this period.</p>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <Activity className="h-5 w-5 text-slate-400" />
          <h3 className="text-base font-semibold text-slate-900">Recent Activity</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {activities.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No recent activity.
            </div>
          ) : (
            activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100">
                  <Activity className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{a.message}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {a.createdAt?.toDate?.()
                      ? a.createdAt.toDate().toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '--'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
