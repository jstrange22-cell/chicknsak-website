import { useState, useMemo } from 'react';
import {
  FileBarChart,
  Plus,
  X,
  Trash2,
  Loader2,
  Search,
  Eye,
  EyeOff,
  Filter,
  Camera,
  ClipboardCheck,
  Shield,
  TrendingUp,
  FileText,
  FolderOpen,
  Clock,
  Users,
  CheckCircle2,
  BarChart3,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import type {
  Report,
  ReportType,
  ReportStatus,
  Project,
  ProjectStatus,
  Task,
  TaskPriority,
} from '@/types';

// ============================================================================
// Helpers
// ============================================================================

function getStartOfWeek(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  return new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
}

function getDaysOfWeek(): { label: string; start: Date; end: Date }[] {
  const weekStart = getStartOfWeek();
  const days: { label: string; start: Date; end: Date }[] = [];
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 0; i < 7; i++) {
    const start = new Date(weekStart);
    start.setDate(weekStart.getDate() + i);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    days.push({ label: labels[i], start, end });
  }
  return days;
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  photo: 'Photo',
  inspection: 'Inspection',
  insurance: 'Insurance',
  progress: 'Progress',
  custom: 'Custom',
};

const REPORT_TYPE_COLORS: Record<ReportType, string> = {
  photo: 'bg-blue-100 text-blue-700',
  inspection: 'bg-purple-100 text-purple-700',
  insurance: 'bg-amber-100 text-amber-700',
  progress: 'bg-emerald-100 text-emerald-700',
  custom: 'bg-slate-100 text-slate-600',
};

const STATUS_COLORS: Record<ReportStatus, string> = {
  draft: 'bg-amber-100 text-amber-700',
  published: 'bg-emerald-100 text-emerald-700',
};

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  lead: 'Lead',
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
  archived: 'Archived',
};

const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  lead: 'bg-sky-500',
  active: 'bg-emerald-500',
  completed: 'bg-blue-500',
  on_hold: 'bg-amber-500',
  archived: 'bg-slate-400',
};

function formatDate(ts: { toDate?: () => Date } | undefined): string {
  if (!ts || !ts.toDate) return '\u2014';
  return ts.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================================
// Reusable Chart Components (CSS-only)
// ============================================================================

function OverviewStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  isLoading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose';
  isLoading?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    rose: 'bg-rose-50 text-rose-600',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-slate-500 truncate">{title}</p>
            {isLoading ? (
              <div className="h-8 w-16 rounded bg-slate-100 animate-pulse mt-1" />
            ) : (
              <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{value}</p>
            )}
            {subtitle && !isLoading && (
              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{subtitle}</p>
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

function HorizontalBar({
  label,
  value,
  maxValue,
  color,
  suffix,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  suffix?: string;
}) {
  const percentage = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;

  return (
    <div className="flex items-center gap-2 md:gap-3 py-1.5">
      <span className="text-xs sm:text-sm text-slate-600 w-20 md:w-28 truncate shrink-0">
        {label}
      </span>
      <div className="flex-1 h-5 sm:h-6 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${Math.max(percentage, percentage > 0 ? 4 : 0)}%` }}
        />
      </div>
      <span className="text-xs sm:text-sm font-semibold text-slate-700 w-12 text-right shrink-0">
        {value}{suffix || ''}
      </span>
    </div>
  );
}

function VerticalBarChart({
  data,
  color,
  maxValue,
}: {
  data: { label: string; value: number }[];
  color: string;
  maxValue: number;
}) {
  return (
    <div className="flex items-end justify-between gap-1 sm:gap-2 h-32 sm:h-40">
      {data.map((item) => {
        const heightPercent = maxValue > 0 ? Math.round((item.value / maxValue) * 100) : 0;
        return (
          <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-700">
              {item.value > 0 ? item.value : ''}
            </span>
            <div className="w-full flex-1 flex items-end">
              <div
                className={cn(
                  'w-full rounded-t-md transition-all duration-500 min-h-[2px]',
                  color,
                  item.value === 0 && 'bg-slate-100'
                )}
                style={{
                  height: `${Math.max(heightPercent, item.value > 0 ? 8 : 2)}%`,
                }}
              />
            </div>
            <span className="text-[10px] sm:text-xs text-slate-500 font-medium">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ProgressRing({
  percentage,
  size = 100,
  strokeWidth = 8,
  color = 'text-emerald-500',
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-slate-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className={color.replace('text-', 'stroke-')}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg sm:text-xl font-bold text-slate-900">
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
}

function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 w-24 bg-slate-100 rounded" />
          <div className="flex-1 h-6 bg-slate-100 rounded-full" />
          <div className="h-3 w-8 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="py-8 text-center">
      <Icon className="h-10 w-10 mx-auto text-slate-300 mb-2" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

// ============================================================================
// Create Report Modal (preserved from original)
// ============================================================================

interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  projects: Project[];
  companyId: string;
  userId: string;
}

function CreateReportModal({
  isOpen,
  onClose,
  onCreated,
  projects,
  companyId,
  userId,
}: CreateReportModalProps) {
  const [name, setName] = useState('');
  const [reportType, setReportType] = useState<ReportType>('photo');
  const [projectId, setProjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setName('');
    setReportType('photo');
    setProjectId('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Report name is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await addDoc(collection(db, 'reports'), {
        companyId,
        projectId: projectId || '',
        name: name.trim(),
        reportType,
        coverTitle: '',
        includeLogo: true,
        sections: [],
        pdfUrl: '',
        shareLink: '',
        shareToken: crypto.randomUUID(),
        status: 'draft' as ReportStatus,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      resetForm();
      onCreated();
      onClose();
    } catch {
      setError('Failed to create report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Create Report</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Report Name
            </label>
            <Input
              placeholder="e.g. Weekly Progress Report"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((type) => (
                <option key={type} value={type}>
                  {REPORT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Project (optional)
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={!name.trim() || isSubmitting}
          >
            <Plus className="h-4 w-4" />
            Create Report
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Analytics Tab Content
// ============================================================================

function AnalyticsTab({ companyId }: { companyId: string }) {
  // -------------------------------------------------------------------
  // 1) PROJECTS DATA (all projects -- used for overview + status + health)
  // -------------------------------------------------------------------
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['reports-analytics', 'projects', companyId],
    queryFn: async (): Promise<Project[]> => {
      if (!companyId) return [];
      const q = query(
        collection(db, 'projects'),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Project);
    },
    enabled: !!companyId,
  });

  const totalProjects = projects?.length ?? 0;
  const activeProjects = projects?.filter((p) => p.status === 'active').length ?? 0;

  // Status breakdown
  const statusBreakdown = useMemo(() => {
    if (!projects) return [];
    const counts: Record<ProjectStatus, number> = {
      lead: 0,
      active: 0,
      completed: 0,
      on_hold: 0,
      archived: 0,
    };
    projects.forEach((p) => {
      if (counts[p.status] !== undefined) {
        counts[p.status]++;
      }
    });
    return (Object.keys(counts) as ProjectStatus[]).map((status) => ({
      status,
      label: PROJECT_STATUS_LABELS[status],
      count: counts[status],
      color: PROJECT_STATUS_COLORS[status],
    }));
  }, [projects]);

  const maxStatusCount = useMemo(() => {
    return Math.max(...statusBreakdown.map((s) => s.count), 1);
  }, [statusBreakdown]);

  // -------------------------------------------------------------------
  // 2) TOTAL PHOTOS
  // -------------------------------------------------------------------
  const { data: totalPhotos, isLoading: photosLoading } = useQuery({
    queryKey: ['reports-analytics', 'totalPhotos', companyId],
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;
      const q = query(
        collection(db, 'photos'),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    },
    enabled: !!companyId,
  });

  // -------------------------------------------------------------------
  // 3) HOURS THIS WEEK
  // -------------------------------------------------------------------
  const weekStart = getStartOfWeek();
  const weekStartTimestamp = Timestamp.fromDate(weekStart);

  const { data: weeklyHours, isLoading: hoursLoading } = useQuery({
    queryKey: ['reports-analytics', 'weeklyHours', companyId],
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;
      const q = query(
        collection(db, 'timeEntries'),
        where('companyId', '==', companyId),
        where('clockInTime', '>=', weekStartTimestamp)
      );
      const snapshot = await getDocs(q);
      let totalMinutes = 0;
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.durationMinutes) totalMinutes += data.durationMinutes;
      });
      return totalMinutes / 60;
    },
    enabled: !!companyId,
  });

  // -------------------------------------------------------------------
  // 4) PHOTOS THIS WEEK (by day)
  // -------------------------------------------------------------------
  interface PhotosByDay {
    days: { label: string; value: number }[];
    total: number;
  }

  const { data: photosThisWeek, isLoading: photosWeekLoading } = useQuery({
    queryKey: ['reports-analytics', 'photosThisWeek', companyId],
    queryFn: async (): Promise<PhotosByDay> => {
      if (!companyId) return { days: [], total: 0 };
      const q = query(
        collection(db, 'photos'),
        where('companyId', '==', companyId),
        where('createdAt', '>=', weekStartTimestamp)
      );
      const snapshot = await getDocs(q);

      const daysOfWeek = getDaysOfWeek();
      const dayCounts = new Array(7).fill(0);

      snapshot.docs.forEach((d) => {
        const data = d.data();
        const createdAt = data.createdAt?.toDate?.();
        if (createdAt) {
          for (let i = 0; i < 7; i++) {
            if (createdAt >= daysOfWeek[i].start && createdAt <= daysOfWeek[i].end) {
              dayCounts[i]++;
              break;
            }
          }
        }
      });

      return {
        days: daysOfWeek.map((d, i) => ({ label: d.label, value: dayCounts[i] })),
        total: snapshot.size,
      };
    },
    enabled: !!companyId,
  });

  const maxPhotosPerDay = useMemo(() => {
    if (!photosThisWeek) return 1;
    return Math.max(...photosThisWeek.days.map((d) => d.value), 1);
  }, [photosThisWeek]);

  // -------------------------------------------------------------------
  // 5) TASKS DATA
  // -------------------------------------------------------------------
  interface TaskStats {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    completionRate: number;
    byPriority: { priority: TaskPriority; label: string; count: number; color: string }[];
  }

  const { data: taskStats, isLoading: tasksLoading } = useQuery({
    queryKey: ['reports-analytics', 'tasks', companyId],
    queryFn: async (): Promise<TaskStats> => {
      if (!companyId)
        return {
          total: 0,
          completed: 0,
          pending: 0,
          inProgress: 0,
          completionRate: 0,
          byPriority: [],
        };

      const q = query(
        collection(db, 'tasks'),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(q);
      const tasks = snapshot.docs.map((d) => d.data() as Task);

      const total = tasks.length;
      const completed = tasks.filter((t) => t.status === 'completed').length;
      const pending = tasks.filter((t) => t.status === 'pending').length;
      const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
      const completionRate = total > 0 ? (completed / total) * 100 : 0;

      const priorityCounts: Record<TaskPriority, number> = {
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0,
      };
      tasks.forEach((t) => {
        if (priorityCounts[t.priority] !== undefined) {
          priorityCounts[t.priority]++;
        }
      });

      const priorityColors: Record<TaskPriority, string> = {
        urgent: 'bg-red-500',
        high: 'bg-orange-500',
        medium: 'bg-amber-500',
        low: 'bg-slate-400',
      };
      const priorityLabels: Record<TaskPriority, string> = {
        urgent: 'Urgent',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
      };

      const byPriority = (['urgent', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => ({
        priority: p,
        label: priorityLabels[p],
        count: priorityCounts[p],
        color: priorityColors[p],
      }));

      return { total, completed, pending, inProgress, completionRate, byPriority };
    },
    enabled: !!companyId,
  });

  // -------------------------------------------------------------------
  // 6) TEAM PERFORMANCE (photos + hours per user this week)
  // -------------------------------------------------------------------
  interface TeamMemberStats {
    userId: string;
    userName: string;
    photos: number;
    hours: number;
  }

  const { data: teamPerformance, isLoading: teamLoading } = useQuery({
    queryKey: ['reports-analytics', 'teamPerformance', companyId],
    queryFn: async (): Promise<TeamMemberStats[]> => {
      if (!companyId) return [];

      // Fetch photos this week
      const photosQuery = query(
        collection(db, 'photos'),
        where('companyId', '==', companyId),
        where('createdAt', '>=', weekStartTimestamp)
      );
      const photosSnapshot = await getDocs(photosQuery);

      // Fetch time entries this week
      const timeQuery = query(
        collection(db, 'timeEntries'),
        where('companyId', '==', companyId),
        where('clockInTime', '>=', weekStartTimestamp)
      );
      const timeSnapshot = await getDocs(timeQuery);

      // Aggregate photos per user
      const photoCountMap = new Map<string, number>();
      photosSnapshot.docs.forEach((d) => {
        const data = d.data();
        const uid = data.uploadedBy as string;
        if (uid) photoCountMap.set(uid, (photoCountMap.get(uid) || 0) + 1);
      });

      // Aggregate hours per user
      const hoursMap = new Map<string, number>();
      timeSnapshot.docs.forEach((d) => {
        const data = d.data();
        const uid = data.userId as string;
        const minutes = (data.durationMinutes as number) || 0;
        if (uid) hoursMap.set(uid, (hoursMap.get(uid) || 0) + minutes);
      });

      // Collect all user IDs
      const allUserIds = new Set<string>();
      photoCountMap.forEach((_, uid) => allUserIds.add(uid));
      hoursMap.forEach((_, uid) => allUserIds.add(uid));

      if (allUserIds.size === 0) return [];

      // Fetch user names
      const userIds = Array.from(allUserIds);
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
        usersSnapshot.docs.forEach((d) => {
          const data = d.data();
          userNameMap.set(d.id, (data.fullName as string) || 'Unknown');
        });
      }

      const result: TeamMemberStats[] = userIds.map((uid) => ({
        userId: uid,
        userName: userNameMap.get(uid) || 'Unknown',
        photos: photoCountMap.get(uid) || 0,
        hours: Math.round(((hoursMap.get(uid) || 0) / 60) * 10) / 10,
      }));

      // Sort by total activity (photos + hours)
      result.sort((a, b) => (b.photos + b.hours) - (a.photos + a.hours));
      return result;
    },
    enabled: !!companyId,
  });

  const maxTeamPhotos = useMemo(() => {
    if (!teamPerformance) return 1;
    return Math.max(...teamPerformance.map((t) => t.photos), 1);
  }, [teamPerformance]);

  const maxTeamHours = useMemo(() => {
    if (!teamPerformance) return 1;
    return Math.max(...teamPerformance.map((t) => t.hours), 1);
  }, [teamPerformance]);

  // -------------------------------------------------------------------
  // 7) PROJECT HEALTH (per active project: photos, tasks, completion)
  // -------------------------------------------------------------------
  interface ProjectHealth {
    projectId: string;
    projectName: string;
    status: ProjectStatus;
    photoCount: number;
    taskCount: number;
    tasksCompleted: number;
    completionPercent: number;
    lastActivity: Date | null;
  }

  const { data: projectHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['reports-analytics', 'projectHealth', companyId],
    queryFn: async (): Promise<ProjectHealth[]> => {
      if (!companyId || !projects) return [];

      const activeProjs = projects.filter(
        (p) => p.status === 'active' || p.status === 'on_hold'
      );
      if (activeProjs.length === 0) return [];

      // Fetch all photos for these projects
      const photosQuery = query(
        collection(db, 'photos'),
        where('companyId', '==', companyId)
      );
      const photosSnapshot = await getDocs(photosQuery);

      // Fetch all tasks for these projects
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('companyId', '==', companyId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);

      // Aggregate per project
      const photosByProject = new Map<string, number>();
      const latestPhotoByProject = new Map<string, Date>();

      photosSnapshot.docs.forEach((d) => {
        const data = d.data();
        const pid = data.projectId as string;
        if (pid) {
          photosByProject.set(pid, (photosByProject.get(pid) || 0) + 1);
          const created = data.createdAt?.toDate?.();
          if (created) {
            const current = latestPhotoByProject.get(pid);
            if (!current || created > current) {
              latestPhotoByProject.set(pid, created);
            }
          }
        }
      });

      const tasksByProject = new Map<string, { total: number; completed: number }>();
      tasksSnapshot.docs.forEach((d) => {
        const data = d.data();
        const pid = data.projectId as string;
        if (pid) {
          const existing = tasksByProject.get(pid) || { total: 0, completed: 0 };
          existing.total++;
          if (data.status === 'completed') existing.completed++;
          tasksByProject.set(pid, existing);
        }
      });

      return activeProjs.map((p) => {
        const tasks = tasksByProject.get(p.id) || { total: 0, completed: 0 };
        const completionPercent =
          tasks.total > 0 ? Math.round((tasks.completed / tasks.total) * 100) : 0;

        // Last activity is the most recent of: project updatedAt, latest photo
        const projectUpdated = p.updatedAt?.toDate?.() || null;
        const latestPhoto = latestPhotoByProject.get(p.id) || null;
        let lastActivity: Date | null = null;
        if (projectUpdated && latestPhoto) {
          lastActivity = projectUpdated > latestPhoto ? projectUpdated : latestPhoto;
        } else {
          lastActivity = projectUpdated || latestPhoto;
        }

        return {
          projectId: p.id,
          projectName: p.name,
          status: p.status,
          photoCount: photosByProject.get(p.id) || 0,
          taskCount: tasks.total,
          tasksCompleted: tasks.completed,
          completionPercent,
          lastActivity,
        };
      });
    },
    enabled: !!companyId && !!projects && projects.length > 0,
  });

  // -------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------

  const formattedHours =
    weeklyHours !== undefined ? `${weeklyHours.toFixed(1)}` : '0.0';

  return (
    <div className="space-y-5 md:space-y-6">
      {/* ---- Section 1: Overview Stats ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
        <OverviewStatCard
          title="Total Projects"
          value={totalProjects}
          icon={FolderOpen}
          color="blue"
          isLoading={projectsLoading}
        />
        <OverviewStatCard
          title="Active Projects"
          value={activeProjects}
          subtitle={
            totalProjects > 0
              ? `${Math.round((activeProjects / totalProjects) * 100)}% of total`
              : undefined
          }
          icon={Activity}
          color="emerald"
          isLoading={projectsLoading}
        />
        <OverviewStatCard
          title="Total Photos"
          value={totalPhotos ?? 0}
          icon={Camera}
          color="purple"
          isLoading={photosLoading}
        />
        <OverviewStatCard
          title="Hours This Week"
          value={`${formattedHours} hrs`}
          icon={Clock}
          color="amber"
          isLoading={hoursLoading}
        />
      </div>

      {/* ---- Section 2 + 3: Project Status + Photos This Week ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Project Status Breakdown */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-5 w-5 text-slate-400" />
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              Project Status Breakdown
            </h2>
          </div>
          <Card>
            <CardContent className="p-4">
              {projectsLoading ? (
                <LoadingSkeleton rows={5} />
              ) : totalProjects > 0 ? (
                <div className="space-y-0.5">
                  {statusBreakdown.map((item) => (
                    <HorizontalBar
                      key={item.status}
                      label={item.label}
                      value={item.count}
                      maxValue={maxStatusCount}
                      color={item.color}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={FolderOpen} message="No projects yet" />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Photos This Week */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Camera className="h-5 w-5 text-slate-400" />
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              Photos This Week
            </h2>
            {photosThisWeek && (
              <span className="ml-auto text-xs text-slate-400 font-medium">
                {photosThisWeek.total} total
              </span>
            )}
          </div>
          <Card>
            <CardContent className="p-4">
              {photosWeekLoading ? (
                <div className="h-40 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : photosThisWeek && photosThisWeek.total > 0 ? (
                <VerticalBarChart
                  data={photosThisWeek.days}
                  color="bg-blue-500"
                  maxValue={maxPhotosPerDay}
                />
              ) : (
                <EmptyState icon={Camera} message="No photos uploaded this week" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---- Section 4: Task Completion Rate ---- */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-5 w-5 text-slate-400" />
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">
            Task Completion Rate
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Completion Ring + Stats */}
          <Card>
            <CardContent className="p-4">
              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : taskStats && taskStats.total > 0 ? (
                <div className="flex items-center gap-6">
                  <ProgressRing
                    percentage={taskStats.completionRate}
                    size={110}
                    strokeWidth={10}
                    color={
                      taskStats.completionRate >= 75
                        ? 'text-emerald-500'
                        : taskStats.completionRate >= 50
                        ? 'text-amber-500'
                        : 'text-red-500'
                    }
                  />
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Total</span>
                      <span className="text-sm font-semibold text-slate-900">
                        {taskStats.total}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Completed</span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {taskStats.completed}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">In Progress</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {taskStats.inProgress}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Pending</span>
                      <span className="text-sm font-semibold text-amber-600">
                        {taskStats.pending}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState icon={ClipboardCheck} message="No tasks created yet" />
              )}
            </CardContent>
          </Card>

          {/* Tasks by Priority */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-slate-500 mb-3">Tasks by Priority</p>
              {tasksLoading ? (
                <LoadingSkeleton rows={4} />
              ) : taskStats && taskStats.total > 0 ? (
                <div className="space-y-0.5">
                  {taskStats.byPriority.map((item) => (
                    <HorizontalBar
                      key={item.priority}
                      label={item.label}
                      value={item.count}
                      maxValue={Math.max(
                        ...taskStats.byPriority.map((p) => p.count),
                        1
                      )}
                      color={item.color}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={ClipboardCheck} message="No tasks to show" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---- Section 5: Team Performance ---- */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-slate-400" />
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">
            Team Performance This Week
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Photos per team member */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-slate-500 mb-3">
                Photos per Team Member
              </p>
              {teamLoading ? (
                <LoadingSkeleton rows={4} />
              ) : teamPerformance && teamPerformance.length > 0 ? (
                <div className="space-y-0.5">
                  {teamPerformance.map((member) => (
                    <HorizontalBar
                      key={member.userId + '-photos'}
                      label={member.userName.split(' ')[0]}
                      value={member.photos}
                      maxValue={maxTeamPhotos}
                      color="bg-blue-500"
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Camera} message="No team activity this week" />
              )}
            </CardContent>
          </Card>

          {/* Hours per team member */}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-slate-500 mb-3">
                Hours Logged per Team Member
              </p>
              {teamLoading ? (
                <LoadingSkeleton rows={4} />
              ) : teamPerformance && teamPerformance.length > 0 ? (
                <div className="space-y-0.5">
                  {teamPerformance.map((member) => (
                    <HorizontalBar
                      key={member.userId + '-hours'}
                      label={member.userName.split(' ')[0]}
                      value={member.hours}
                      maxValue={maxTeamHours}
                      color="bg-emerald-500"
                      suffix=" hrs"
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Clock} message="No hours logged this week" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---- Section 6: Project Health Overview ---- */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5 text-slate-400" />
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">
            Project Health Overview
          </h2>
          <span className="text-xs text-slate-400 font-medium">Active &amp; On Hold</span>
        </div>

        {healthLoading ? (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-4 w-32 bg-slate-100 rounded" />
                    <div className="flex-1 h-4 bg-slate-100 rounded" />
                    <div className="h-4 w-16 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : projectHealth && projectHealth.length > 0 ? (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3">Project</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-center">Photos</th>
                        <th className="px-4 py-3 text-center">Tasks</th>
                        <th className="px-4 py-3">Completion</th>
                        <th className="px-4 py-3">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {projectHealth.map((ph) => (
                        <tr key={ph.projectId} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-slate-900 truncate max-w-[200px] block">
                              {ph.projectName}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white',
                                PROJECT_STATUS_COLORS[ph.status]
                              )}
                            >
                              {PROJECT_STATUS_LABELS[ph.status]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm font-medium text-slate-700">
                              {ph.photoCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-sm text-slate-700">
                              {ph.tasksCompleted}/{ph.taskCount}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    ph.completionPercent >= 75
                                      ? 'bg-emerald-500'
                                      : ph.completionPercent >= 50
                                      ? 'bg-amber-500'
                                      : ph.completionPercent > 0
                                      ? 'bg-red-400'
                                      : 'bg-slate-200'
                                  )}
                                  style={{
                                    width: `${ph.completionPercent}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium text-slate-600 w-8">
                                {ph.completionPercent}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-slate-500">
                              {ph.lastActivity
                                ? ph.lastActivity.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : '\u2014'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden space-y-3">
              {projectHealth.map((ph) => (
                <Card key={ph.projectId}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {ph.projectName}
                        </p>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white mt-1',
                            PROJECT_STATUS_COLORS[ph.status]
                          )}
                        >
                          {PROJECT_STATUS_LABELS[ph.status]}
                        </span>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-lg font-bold text-slate-900">
                          {ph.completionPercent}%
                        </p>
                        <p className="text-[10px] text-slate-400">complete</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          ph.completionPercent >= 75
                            ? 'bg-emerald-500'
                            : ph.completionPercent >= 50
                            ? 'bg-amber-500'
                            : ph.completionPercent > 0
                            ? 'bg-red-400'
                            : 'bg-slate-200'
                        )}
                        style={{ width: `${ph.completionPercent}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {ph.photoCount}
                        </p>
                        <p className="text-[10px] text-slate-400">Photos</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {ph.tasksCompleted}/{ph.taskCount}
                        </p>
                        <p className="text-[10px] text-slate-400">Tasks</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {ph.lastActivity
                            ? ph.lastActivity.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : '\u2014'}
                        </p>
                        <p className="text-[10px] text-slate-400">Last Active</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-4">
              <EmptyState
                icon={AlertTriangle}
                message="No active or on-hold projects to display"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Reports Tab Content (preserved existing functionality)
// ============================================================================

function ReportsTab({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ReportType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch reports
  const {
    data: reports = [],
    isLoading: reportsLoading,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ['reports-tab', 'reports', companyId],
    queryFn: async (): Promise<Report[]> => {
      if (!companyId) return [];
      const q = query(
        collection(db, 'reports'),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Report[];
      data.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch projects for dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ['reports-tab', 'projects', companyId],
    queryFn: async (): Promise<Project[]> => {
      if (!companyId) return [];
      const q = query(
        collection(db, 'projects'),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Project[];
    },
    enabled: !!companyId,
  });

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, p.name);
    }
    return map;
  }, [projects]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (typeFilter !== 'all' && r.reportType !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesProject = projectNameMap
          .get(r.projectId)
          ?.toLowerCase()
          .includes(q);
        if (!matchesName && !matchesProject) return false;
      }
      return true;
    });
  }, [reports, typeFilter, statusFilter, searchQuery, projectNameMap]);

  const handleToggleStatus = async (report: Report) => {
    setTogglingId(report.id);
    const newStatus: ReportStatus =
      report.status === 'draft' ? 'published' : 'draft';
    try {
      await updateDoc(doc(db, 'reports', report.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      refetchReports();
    } catch (err) {
      console.error('Failed to update report status:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    setDeletingId(reportId);
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      refetchReports();
    } catch (err) {
      console.error('Failed to delete report:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const reportTemplates = [
    {
      id: 'daily-progress',
      name: 'Daily Progress Report',
      type: 'progress' as ReportType,
      description: 'Track daily work progress with photos and notes',
      icon: TrendingUp,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      iconBg: 'bg-emerald-100',
    },
    {
      id: 'photo-documentation',
      name: 'Photo Documentation',
      type: 'photo' as ReportType,
      description: 'Before/after photos organized by project area',
      icon: Camera,
      color: 'bg-blue-50 text-blue-600 border-blue-200',
      iconBg: 'bg-blue-100',
    },
    {
      id: 'inspection',
      name: 'Inspection Report',
      type: 'inspection' as ReportType,
      description: 'Detailed site inspection with checklist items',
      icon: ClipboardCheck,
      color: 'bg-purple-50 text-purple-600 border-purple-200',
      iconBg: 'bg-purple-100',
    },
    {
      id: 'insurance',
      name: 'Insurance Documentation',
      type: 'insurance' as ReportType,
      description: 'Comprehensive documentation for insurance claims',
      icon: Shield,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
      iconBg: 'bg-amber-100',
    },
  ];

  const handleCreateFromTemplate = async (
    template: (typeof reportTemplates)[0]
  ) => {
    if (!companyId || !userId) return;
    try {
      await addDoc(collection(db, 'reports'), {
        companyId,
        projectId: '',
        name: template.name,
        reportType: template.type,
        coverTitle: '',
        includeLogo: true,
        sections: [],
        pdfUrl: '',
        shareLink: '',
        shareToken: crypto.randomUUID(),
        status: 'draft' as ReportStatus,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      refetchReports();
    } catch (err) {
      console.error('Failed to create report from template:', err);
    }
  };

  return (
    <div className="space-y-5">
      {/* Quick Templates */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          Quick Templates
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {reportTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleCreateFromTemplate(template)}
              className={cn(
                'flex flex-col items-start p-3 md:p-4 rounded-xl border text-left transition-all hover:shadow-md active:scale-[0.98] touch-manipulation',
                template.color
              )}
            >
              <div className={cn('p-2 rounded-lg mb-2', template.iconBg)}>
                <template.icon className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold leading-tight">
                {template.name}
              </p>
              <p className="text-[11px] md:text-xs mt-1 opacity-70 leading-snug line-clamp-2">
                {template.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by report name or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as ReportType | 'all')
            }
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <option value="all">All Types</option>
            {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((type) => (
              <option key={type} value={type}>
                {REPORT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          {(['all', 'draft', 'published'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Report List */}
      {reportsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <FileBarChart className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-slate-900">
            {reports.length > 0 ? 'No matching reports' : 'No reports yet'}
          </h3>
          <p className="max-w-[280px] text-center text-sm leading-relaxed text-slate-500">
            {reports.length > 0
              ? 'Try adjusting your search or filters.'
              : 'Create your first report to get started.'}
          </p>
          {reports.length === 0 && (
            <Button
              className="mt-4"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4" />
              Create Report
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Project</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report) => {
                  const projectName = report.projectId
                    ? projectNameMap.get(report.projectId) || '\u2014'
                    : '\u2014';

                  return (
                    <tr key={report.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-900">
                          {report.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            REPORT_TYPE_COLORS[report.reportType]
                          )}
                        >
                          {REPORT_TYPE_LABELS[report.reportType]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_COLORS[report.status]
                          )}
                        >
                          {report.status.charAt(0).toUpperCase() +
                            report.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-sm text-slate-500">
                          {projectName}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-sm text-slate-500">
                          {formatDate(report.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleStatus(report)}
                            disabled={togglingId === report.id}
                            className={cn(
                              'rounded-md p-1.5 transition-colors disabled:opacity-50',
                              report.status === 'draft'
                                ? 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                                : 'text-emerald-500 hover:bg-amber-50 hover:text-amber-600'
                            )}
                            title={
                              report.status === 'draft'
                                ? 'Publish report'
                                : 'Unpublish report'
                            }
                          >
                            {togglingId === report.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : report.status === 'draft' ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(report.id)}
                            disabled={deletingId === report.id}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            title="Delete report"
                          >
                            {deletingId === report.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Report Modal */}
      <CreateReportModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => refetchReports()}
        projects={projects}
        companyId={companyId}
        userId={userId}
      />
    </div>
  );
}

// ============================================================================
// Main Reports Page with Tabs
// ============================================================================

type TabId = 'analytics' | 'reports';

export default function ReportsPage() {
  const { user, profile } = useAuthContext();
  const [activeTab, setActiveTab] = useState<TabId>('analytics');

  const companyId = profile?.companyId || '';
  const userId = user?.uid || '';

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'reports', label: 'Reports', icon: FileBarChart },
  ];

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col px-1 md:px-0">
      {/* Page Header */}
      <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Reports &amp; Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time project analytics and performance statistics.
          </p>
        </div>
        {activeTab === 'reports' && (
          <Button
            onClick={() => {
              /* The button in ReportsTab handles it */
            }}
            className="self-start sm:self-auto hidden"
          >
            <Plus className="h-4 w-4" />
            Create Report
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-lg bg-slate-100 p-1 self-start">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="pb-24 md:pb-8">
        {activeTab === 'analytics' ? (
          <AnalyticsTab companyId={companyId} />
        ) : (
          <ReportsTab companyId={companyId} userId={userId} />
        )}
      </div>
    </div>
  );
}
