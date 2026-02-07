import { useAuthContext } from '@/components/auth/AuthProvider';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  FolderOpen,
  Camera,
  Users,
  Clock,
  TrendingUp,
  ShieldAlert,
  Activity,
  CheckCircle2,
  XCircle,
  CalendarDays,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ActivityLogEntry, TimeEntry } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  return new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
}

// ---------------------------------------------------------------------------
// Overview Stat Card
// ---------------------------------------------------------------------------

function OverviewCard({
  title,
  value,
  icon: Icon,
  color,
  isLoading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: 'blue' | 'emerald' | 'amber' | 'purple';
  isLoading?: boolean;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-sm text-slate-500 truncate">{title}</p>
            {isLoading ? (
              <div className="h-8 w-16 rounded bg-slate-100 animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
            )}
          </div>
          <div className={cn('p-2 rounded-lg shrink-0', colorClasses[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CSS Bar Chart Row
// ---------------------------------------------------------------------------

function BarChartRow({
  label,
  value,
  maxValue,
  color,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}) {
  const percentage = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-sm text-slate-600 w-28 truncate shrink-0">
        {label}
      </span>
      <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${Math.max(percentage, 2)}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-slate-700 w-8 text-right shrink-0">
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity Feed Item
// ---------------------------------------------------------------------------

function ActivityFeedItem({ activity }: { activity: ActivityLogEntry }) {
  const createdAt = activity.createdAt?.toDate
    ? activity.createdAt.toDate()
    : new Date();

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700 leading-snug line-clamp-2">
          {activity.message}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {formatRelativeTime(createdAt)}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending Approval Row
// ---------------------------------------------------------------------------

function ApprovalRow({
  entry,
  userName,
}: {
  entry: TimeEntry;
  userName: string;
}) {
  const clockIn = entry.clockInTime?.toDate
    ? entry.clockInTime.toDate()
    : new Date();
  const hours = entry.durationMinutes
    ? (entry.durationMinutes / 60).toFixed(1)
    : '--';

  const dateLabel = clockIn.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700 truncate">
          {userName}
        </p>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
          <CalendarDays className="h-3 w-3" />
          <span>{dateLabel}</span>
          <span className="text-slate-300">|</span>
          <Clock className="h-3 w-3" />
          <span>{hours} hrs</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
          title="Approve"
        >
          <CheckCircle2 className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-red-500 hover:bg-red-50"
          title="Reject"
        >
          <XCircle className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Access Denied Component
// ---------------------------------------------------------------------------

function AccessDenied() {
  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="p-4 rounded-full bg-red-50 mb-4">
        <ShieldAlert className="h-12 w-12 text-red-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
      <p className="text-slate-500 text-center max-w-sm">
        The admin dashboard is only available to users with admin or manager
        roles. Contact your company administrator if you need access.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const { profile } = useAuthContext();

  const companyId = profile?.companyId;
  const userRole = profile?.role;

  // Gate: admin or manager only (null profile = still loading, not denied)
  const profileLoaded = profile !== null && profile !== undefined;
  const hasAccess = userRole === 'admin' || userRole === 'manager';

  // ---- Overview Stats ----

  // Total projects
  const { data: totalProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ['dashboard', 'totalProjects', companyId],
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;
      const q = query(
        collection(db, 'projects'),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    },
    enabled: !!companyId && hasAccess,
  });

  // Total photos
  const { data: totalPhotos, isLoading: photosLoading } = useQuery({
    queryKey: ['dashboard', 'totalPhotos', companyId],
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;
      const q = query(
        collection(db, 'photos'),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    },
    enabled: !!companyId && hasAccess,
  });

  // Team members
  const { data: teamMembers, isLoading: teamLoading } = useQuery({
    queryKey: ['dashboard', 'teamMembers', companyId],
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;
      const q = query(
        collection(db, 'users'),
        where('companyId', '==', companyId),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    },
    enabled: !!companyId && hasAccess,
  });

  // Company-wide hours this week
  const { data: companyWeeklyHours, isLoading: companyHoursLoading } = useQuery({
    queryKey: ['dashboard', 'companyWeeklyHours', companyId],
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;
      const weekStart = getStartOfWeek();
      const q = query(
        collection(db, 'timeEntries'),
        where('companyId', '==', companyId),
        where('clockInTime', '>=', Timestamp.fromDate(weekStart))
      );
      const snapshot = await getDocs(q);
      let totalMinutes = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.durationMinutes) {
          totalMinutes += data.durationMinutes;
        }
      });
      return totalMinutes / 60;
    },
    enabled: !!companyId && hasAccess,
  });

  // ---- Team Activity: photos per user this week ----

  interface UserPhotoCount {
    userId: string;
    userName: string;
    count: number;
  }

  const { data: photosPerUser, isLoading: teamActivityLoading } = useQuery({
    queryKey: ['dashboard', 'photosPerUser', companyId],
    queryFn: async (): Promise<UserPhotoCount[]> => {
      if (!companyId) return [];
      const weekStart = getStartOfWeek();

      // Fetch photos this week
      const photosQuery = query(
        collection(db, 'photos'),
        where('companyId', '==', companyId),
        where('createdAt', '>=', Timestamp.fromDate(weekStart))
      );
      const photosSnapshot = await getDocs(photosQuery);

      // Aggregate by uploadedBy
      const countMap = new Map<string, number>();
      photosSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const uid = data.uploadedBy as string;
        if (uid) {
          countMap.set(uid, (countMap.get(uid) || 0) + 1);
        }
      });

      if (countMap.size === 0) return [];

      // Fetch user names for the uploaders
      const userIds = Array.from(countMap.keys());

      // Firestore 'in' query supports up to 30 items; handle batching
      const userNameMap = new Map<string, string>();
      const batches: string[][] = [];
      for (let i = 0; i < userIds.length; i += 30) {
        batches.push(userIds.slice(i, i + 30));
      }

      for (const batch of batches) {
        const usersQuery = query(
          collection(db, 'users'),
          where('__name__', 'in', batch)
        );
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          userNameMap.set(doc.id, (data.fullName as string) || 'Unknown');
        });
      }

      const result: UserPhotoCount[] = userIds.map((uid) => ({
        userId: uid,
        userName: userNameMap.get(uid) || 'Unknown',
        count: countMap.get(uid) || 0,
      }));

      // Sort descending by count
      result.sort((a, b) => b.count - a.count);
      return result;
    },
    enabled: !!companyId && hasAccess,
  });

  // ---- Recent Company Activity ----

  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard', 'recentActivity', companyId],
    queryFn: async (): Promise<ActivityLogEntry[]> => {
      if (!companyId) return [];
      const q = query(
        collection(db, 'activityLog'),
        where('companyId', '==', companyId),
      );
      const snapshot = await getDocs(q);
      const entries = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as ActivityLogEntry
      );
      entries.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return entries.slice(0, 20);
    },
    enabled: !!companyId && hasAccess,
  });

  // ---- Pending Approvals: time entries with status='completed' ----

  interface PendingApproval {
    entry: TimeEntry;
    userName: string;
  }

  const { data: pendingApprovals, isLoading: approvalsLoading } = useQuery({
    queryKey: ['dashboard', 'pendingApprovals', companyId],
    queryFn: async (): Promise<PendingApproval[]> => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'timeEntries'),
        where('companyId', '==', companyId),
        where('status', '==', 'completed'),
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return [];

      const entries = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as TimeEntry
      );
      entries.sort((a, b) => {
        const aTime = a.clockInTime?.toDate?.()?.getTime() || 0;
        const bTime = b.clockInTime?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      entries.splice(20); // limit to 20

      // Resolve user names
      const uniqueUserIds = [...new Set(entries.map((e) => e.userId))];
      const userNameMap = new Map<string, string>();

      const batches: string[][] = [];
      for (let i = 0; i < uniqueUserIds.length; i += 30) {
        batches.push(uniqueUserIds.slice(i, i + 30));
      }

      for (const batch of batches) {
        const usersQuery = query(
          collection(db, 'users'),
          where('__name__', 'in', batch)
        );
        const usersSnapshot = await getDocs(usersQuery);
        usersSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          userNameMap.set(doc.id, (data.fullName as string) || 'Unknown');
        });
      }

      return entries.map((entry) => ({
        entry,
        userName: userNameMap.get(entry.userId) || 'Unknown',
      }));
    },
    enabled: !!companyId && hasAccess,
  });

  // ---- Access gate ----

  // If profile hasn't loaded yet (e.g. offline), show loading instead of Access Denied
  if (!profileLoaded) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  // ---- Derived values ----

  const formattedCompanyHours =
    companyWeeklyHours !== undefined
      ? `${companyWeeklyHours.toFixed(1)} hrs`
      : '0.0 hrs';

  const maxPhotos =
    photosPerUser && photosPerUser.length > 0
      ? Math.max(...photosPerUser.map((u) => u.count))
      : 0;

  // ---- Render ----

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-500 mt-1">Company-wide overview and analytics</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-3">
        <OverviewCard
          title="Total Projects"
          value={totalProjects ?? 0}
          icon={FolderOpen}
          color="blue"
          isLoading={projectsLoading}
        />
        <OverviewCard
          title="Total Photos"
          value={totalPhotos ?? 0}
          icon={Camera}
          color="emerald"
          isLoading={photosLoading}
        />
        <OverviewCard
          title="Team Members"
          value={teamMembers ?? 0}
          icon={Users}
          color="purple"
          isLoading={teamLoading}
        />
        <OverviewCard
          title="Hours This Week"
          value={formattedCompanyHours}
          icon={Clock}
          color="amber"
          isLoading={companyHoursLoading}
        />
      </div>

      {/* Team Activity: Photos per User this week */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">
            Team Activity
          </h2>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Photos uploaded per team member this week
        </p>

        <Card>
          <CardContent className="p-4">
            {teamActivityLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="h-3 w-24 bg-slate-100 rounded" />
                    <div className="flex-1 h-6 bg-slate-100 rounded-full" />
                    <div className="h-3 w-6 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
            ) : photosPerUser && photosPerUser.length > 0 ? (
              <div>
                {photosPerUser.map((userStat) => (
                  <BarChartRow
                    key={userStat.userId}
                    label={userStat.userName}
                    value={userStat.count}
                    maxValue={maxPhotos}
                    color="bg-blue-500"
                  />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <Camera className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">
                  No photos uploaded this week
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">
            Pending Approvals
          </h2>
          {pendingApprovals && pendingApprovals.length > 0 && (
            <span className="ml-auto inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
              {pendingApprovals.length}
            </span>
          )}
        </div>

        <Card>
          <CardContent className="p-4">
            {approvalsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between animate-pulse py-3"
                  >
                    <div className="space-y-2">
                      <div className="h-3 w-28 bg-slate-100 rounded" />
                      <div className="h-2 w-40 bg-slate-100 rounded" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-8 bg-slate-100 rounded" />
                      <div className="h-8 w-8 bg-slate-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pendingApprovals && pendingApprovals.length > 0 ? (
              <div>
                {pendingApprovals.map(({ entry, userName }) => (
                  <ApprovalRow
                    key={entry.id}
                    entry={entry}
                    userName={userName}
                  />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <CheckCircle2 className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">
                  No pending time entry approvals
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Feed */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Activity
          </h2>
        </div>

        <Card>
          <CardContent className="p-4">
            {activityLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-slate-200 mt-2" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-full bg-slate-100 rounded" />
                      <div className="h-2 w-16 bg-slate-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity && recentActivity.length > 0 ? (
              <div>
                {recentActivity.map((activity) => (
                  <ActivityFeedItem key={activity.id} activity={activity} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Activity className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No recent activity</p>
                <p className="text-xs text-slate-400 mt-1">
                  Company-wide activity will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
