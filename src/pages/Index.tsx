import { useAuthContext } from '@/components/auth/AuthProvider';
import { Card, CardContent } from '@/components/ui/Card';
import {
  Camera,
  Clock,
  MessageSquare,
  ChevronRight,
  MapPin,
  Image,
  ListTodo,
  FolderOpen,
  Sunrise,
  Sun,
  Moon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
import { useTaskCounts } from '@/hooks/useTasks';
import { useUnreadCount } from '@/hooks/useNotifications';
import type { Project, ActivityLogEntry } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - day; // adjust to Sunday
  const start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
  return start;
}

function getGreeting(): { text: string; Icon: React.ElementType } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', Icon: Sunrise };
  if (hour < 18) return { text: 'Good afternoon', Icon: Sun };
  return { text: 'Good evening', Icon: Moon };
}

// Gradient placeholders for project cards without cover photos
const gradients = [
  'from-blue-400 to-indigo-500',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
  'from-rose-400 to-pink-500',
  'from-violet-400 to-purple-500',
  'from-cyan-400 to-sky-500',
];

function pickGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

// ---------------------------------------------------------------------------
// Activity Feed Item -- photo-rich style
// ---------------------------------------------------------------------------

function ActivityFeedItem({ activity }: { activity: ActivityLogEntry }) {
  const createdAt = activity.createdAt?.toDate
    ? activity.createdAt.toDate()
    : new Date();

  const isPhotoActivity =
    activity.activityType === 'photo_uploaded' ||
    activity.activityType === 'photo_annotated';

  return (
    <Link
      to={
        activity.projectId
          ? `/projects/${activity.projectId}`
          : '#'
      }
      className="flex gap-3 py-3.5 border-b border-slate-100/80 last:border-0 active:bg-slate-50 transition-colors -mx-1 px-1 rounded-lg"
    >
      {/* Thumbnail */}
      {activity.thumbnailUrl ? (
        <img
          src={activity.thumbnailUrl}
          alt=""
          className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-sm"
        />
      ) : (
        <div
          className={cn(
            'w-14 h-14 rounded-xl flex items-center justify-center shrink-0',
            isPhotoActivity
              ? 'bg-blue-50'
              : 'bg-slate-100'
          )}
        >
          {isPhotoActivity ? (
            <Camera className="h-5 w-5 text-blue-400" />
          ) : (
            <Clock className="h-5 w-5 text-slate-400" />
          )}
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">
          {activity.message}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {formatRelativeTime(createdAt)}
        </p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Index() {
  const { profile, user } = useAuthContext();
  const companyId = profile?.companyId;
  const userId = user?.uid;

  // ---- Stats Queries (kept intact) ----

  const { data: pendingTaskCount, isLoading: tasksLoading } = useTaskCounts();
  const { data: unreadCount, isLoading: unreadLoading } = useUnreadCount(userId);

  // Active projects count
  const { data: activeProjectCount, isLoading: projectsCountLoading } = useQuery({
    queryKey: ['activeProjectCount', companyId],
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;
      const q = query(
        collection(db, 'projects'),
        where('companyId', '==', companyId),
        where('status', '==', 'active')
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    },
    enabled: !!companyId,
  });

  // Weekly hours for current user
  const { data: weeklyHours, isLoading: hoursLoading } = useQuery({
    queryKey: ['weeklyHours', userId],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      const weekStart = getStartOfWeek();
      const q = query(
        collection(db, 'timeEntries'),
        where('userId', '==', userId),
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
    enabled: !!userId,
  });

  // ---- Recent Projects ----

  const { data: recentProjects, isLoading: projectsLoading } = useQuery({
    queryKey: ['recentProjects', companyId],
    queryFn: async (): Promise<Project[]> => {
      if (!companyId) return [];
      const q = query(
        collection(db, 'projects'),
        where('companyId', '==', companyId),
        where('status', '==', 'active'),
      );
      const snapshot = await getDocs(q);
      const projects = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Project
      );
      projects.sort((a, b) => {
        const aTime = a.updatedAt?.toDate?.()?.getTime() || 0;
        const bTime = b.updatedAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return projects.slice(0, 6);
    },
    enabled: !!companyId,
  });

  // ---- Recent Activity ----

  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['recentActivity', companyId],
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
      return entries.slice(0, 10);
    },
    enabled: !!companyId,
  });

  // ---- Derived values ----

  const firstName = profile?.fullName?.split(' ')[0] || 'there';
  const { text: greetingText, Icon: GreetingIcon } = getGreeting();
  const formattedHours =
    weeklyHours !== undefined ? weeklyHours.toFixed(1) : '0.0';

  // ---- Render ----

  return (
    <div className="pb-28 md:pb-8">
      {/* ================================================================
          DARK HERO HEADER
          ================================================================ */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800/90 px-5 md:px-8 pt-6 pb-20 md:pb-24 md:rounded-2xl md:-mx-0">
        <div className="flex items-center gap-2.5 mb-1">
          <GreetingIcon className="h-5 w-5 text-amber-400" />
          <span className="text-amber-400/90 text-sm font-medium">{greetingText}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          {firstName}
        </h1>

        {/* Summary chips */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 active:bg-white/20 text-white/90 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {projectsCountLoading ? (
              <span className="w-4 h-3 bg-white/20 rounded animate-pulse inline-block" />
            ) : (
              <span>{activeProjectCount ?? 0} projects</span>
            )}
          </Link>
          <Link
            to="/my-stuff"
            className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 active:bg-white/20 text-white/90 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
          >
            <ListTodo className="h-3.5 w-3.5" />
            {tasksLoading ? (
              <span className="w-4 h-3 bg-white/20 rounded animate-pulse inline-block" />
            ) : (
              <span>{pendingTaskCount ?? 0} tasks</span>
            )}
          </Link>
          <Link
            to="/timeclock"
            className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 active:bg-white/20 text-white/90 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
          >
            <Clock className="h-3.5 w-3.5" />
            {hoursLoading ? (
              <span className="w-6 h-3 bg-white/20 rounded animate-pulse inline-block" />
            ) : (
              <span>{formattedHours} hrs</span>
            )}
          </Link>
        </div>
      </div>

      {/* ================================================================
          QUICK ACTIONS -- overlapping the header
          ================================================================ */}
      <div className="px-5 md:px-8 -mt-12 md:-mt-16 max-w-5xl">
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-4 md:p-6">
          <div className="flex items-center justify-around md:justify-start md:gap-10">
            {/* CAMERA -- hero action */}
            <Link
              to="/camera"
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30 transition-transform group-active:scale-90 group-hover:shadow-blue-500/40">
                <Camera className="h-7 w-7 text-white" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Camera</span>
            </Link>

            {/* Clock In */}
            <Link
              to="/timeclock"
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center transition-transform group-active:scale-90">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-xs font-medium text-slate-600">Clock In</span>
            </Link>

            {/* New Task */}
            <Link
              to="/my-stuff"
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center transition-transform group-active:scale-90">
                <ListTodo className="h-5 w-5 text-violet-600" />
              </div>
              <span className="text-xs font-medium text-slate-600">New Task</span>
            </Link>

            {/* Messages */}
            <Link
              to="/messages"
              className="flex flex-col items-center gap-2 group relative"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center transition-transform group-active:scale-90">
                <MessageSquare className="h-5 w-5 text-emerald-600" />
              </div>
              {!unreadLoading && (unreadCount ?? 0) > 0 && (
                <span className="absolute -top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 shadow-sm">
                  {unreadCount! > 99 ? '99+' : unreadCount}
                </span>
              )}
              <span className="text-xs font-medium text-slate-600">Messages</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ================================================================
          RECENT PROJECTS + ACTIVITY -- side by side on desktop
          ================================================================ */}
      <div className="md:flex md:gap-6 md:px-8 md:mt-8">

      {/* Recent Projects */}
      <div className="mt-7 md:mt-0 md:flex-1">
        <div className="flex items-center justify-between px-5 md:px-0 mb-3">
          <h2 className="text-lg font-bold text-slate-900">
            Recent Projects
          </h2>
          <Link
            to="/projects"
            className="text-sm text-blue-500 font-medium flex items-center gap-0.5 hover:text-blue-600 active:text-blue-700"
          >
            See all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {projectsLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 px-5 md:px-0 scrollbar-hide md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-48 md:w-auto shrink-0 md:shrink rounded-2xl bg-white border border-slate-100 shadow-md overflow-hidden animate-pulse"
              >
                <div className="h-28 bg-slate-100" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-28 bg-slate-100 rounded" />
                  <div className="h-3 w-20 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : recentProjects && recentProjects.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2 px-5 md:px-0 scrollbar-hide md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible">
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="w-48 md:w-auto shrink-0 md:shrink rounded-2xl bg-white border border-slate-100 shadow-md overflow-hidden hover:shadow-lg transition-shadow active:scale-[0.98] transition-transform"
              >
                {/* Cover photo area */}
                <div
                  className={cn(
                    'h-28 relative flex items-end',
                    'bg-gradient-to-br',
                    pickGradient(project.id)
                  )}
                >
                  {/* Photo count badge */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                    <Image className="h-3 w-3" />
                    <span>--</span>
                  </div>
                  {/* Gradient overlay at bottom for readability */}
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/40 to-transparent" />
                </div>

                {/* Project info */}
                <div className="p-3">
                  <h3 className="font-semibold text-slate-900 text-sm leading-tight line-clamp-1">
                    {project.name}
                  </h3>
                  {project.addressFull && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-1.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{project.addressFull}</span>
                    </div>
                  )}
                  {project.customerName && !project.addressFull && (
                    <p className="text-xs text-slate-400 mt-1.5 truncate">
                      {project.customerName}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="mx-5 md:mx-0">
            <Card className="border-dashed border-2 border-slate-200 shadow-none bg-slate-50/50">
              <CardContent className="py-10 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <FolderOpen className="h-7 w-7 text-blue-400" />
                </div>
                <p className="font-semibold text-slate-700 text-sm">
                  No projects yet
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">
                  Your recent projects will show up here once you get started.
                </p>
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-blue-500 hover:text-blue-600"
                >
                  Create a project
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ================================================================
          ACTIVITY FEED -- photo-rich
          ================================================================ */}
      <div className="mt-7 md:mt-0 px-5 md:px-0 md:w-[380px] md:flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-900">
            Activity
          </h2>
        </div>

        {activityLoading ? (
          <Card className="shadow-md rounded-2xl border-slate-100">
            <CardContent className="p-4 pt-4">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="w-14 h-14 rounded-xl bg-slate-100 shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-3.5 w-full bg-slate-100 rounded" />
                      <div className="h-3 w-24 bg-slate-100 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : recentActivity && recentActivity.length > 0 ? (
          <Card className="shadow-md rounded-2xl border-slate-100">
            <CardContent className="p-4 pt-4">
              {recentActivity.map((activity) => (
                <ActivityFeedItem key={activity.id} activity={activity} />
              ))}
            </CardContent>
          </Card>
        ) : (
          /* Empty state */
          <Card className="border-dashed border-2 border-slate-200 shadow-none bg-slate-50/50 rounded-2xl">
            <CardContent className="py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Camera className="h-7 w-7 text-amber-400" />
              </div>
              <p className="font-semibold text-slate-700 text-sm">
                No activity yet
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-[220px] mx-auto">
                Snap a photo or create a project and your team's activity will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      </div>{/* end md:flex wrapper */}
    </div>
  );
}
