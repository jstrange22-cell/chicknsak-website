import { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Clock,
  Plus,
  X,
  Check,
  Ban,
  Loader2,
  MapPin,
  ChevronDown,
  Calendar,
  CalendarDays,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { ClockInOut } from '@/components/timeclock/ClockInOut';
import { WeeklyTimesheet } from '@/components/timeclock/WeeklyTimesheet';
import { LiveLocationBadge } from '@/components/timeclock/LiveLocationBadge';
import { LocationMap } from '@/components/timeclock/LocationMap';
import {
  getWeekRange,
  useMyTimeEntries,
  useTeamTimeEntries,
  useActiveEntry,
  useCreateManualEntry,
  useApproveEntry,
  useRejectEntry,
} from '@/hooks/useTimeEntries';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useProjects } from '@/hooks/useProjects';
import {
  useMyTimeOffRequests,
  useCreateTimeOffRequest,
} from '@/hooks/useTimeOffRequests';
import type { TimeEntry, TimeOffRequest, TimeOffType, User as UserType } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeekLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString([], opts);
  const endStr = end.toLocaleDateString([], opts);
  return `${startStr} – ${endStr}`;
}

function formatDuration(minutes: number | undefined): string {
  if (minutes == null || minutes <= 0) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatTime(ts: { toDate: () => Date } | undefined): string {
  if (!ts) return '--:--';
  return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const statusConfig: Record<TimeEntry['status'], { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', classes: 'bg-slate-100 text-slate-700' },
  approved: { label: 'Approved', classes: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', classes: 'bg-red-100 text-red-700' },
};

// ---------------------------------------------------------------------------
// Week Navigation Hook
// ---------------------------------------------------------------------------

function useWeekNav() {
  const [offset, setOffset] = useState(0);

  const { start, end } = useMemo(() => {
    const ref = new Date();
    ref.setDate(ref.getDate() + offset * 7);
    return getWeekRange(ref);
  }, [offset]);

  return {
    start,
    end,
    label: formatWeekLabel(start, end),
    goToPrev: () => setOffset((o) => o - 1),
    goToNext: () => setOffset((o) => o + 1),
    isCurrentWeek: offset === 0,
  };
}

// ---------------------------------------------------------------------------
// Time-Off Helpers
// ---------------------------------------------------------------------------

const timeOffTypeConfig: Record<TimeOffType, { label: string; classes: string }> = {
  vacation: { label: 'Vacation', classes: 'bg-blue-100 text-blue-700' },
  sick: { label: 'Sick', classes: 'bg-red-100 text-red-700' },
  personal: { label: 'Personal', classes: 'bg-purple-100 text-purple-700' },
  unpaid: { label: 'Unpaid', classes: 'bg-orange-100 text-orange-700' },
  other: { label: 'Other', classes: 'bg-slate-100 text-slate-700' },
};

const timeOffStatusConfig: Record<TimeOffRequest['status'], { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', classes: 'bg-emerald-100 text-emerald-700' },
  denied: { label: 'Denied', classes: 'bg-red-100 text-red-700' },
};

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (start === end) return s.toLocaleDateString([], opts);
  return `${s.toLocaleDateString([], opts)} - ${e.toLocaleDateString([], opts)}`;
}

// ---------------------------------------------------------------------------
// Request Time Off Modal
// ---------------------------------------------------------------------------

interface RequestTimeOffModalProps {
  onClose: () => void;
}

function RequestTimeOffModal({ onClose }: RequestTimeOffModalProps) {
  const createRequest = useCreateTimeOffRequest();
  const [type, setType] = useState<TimeOffType>('vacation');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [endDate, setEndDate] = useState(startDate);
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    if (endDate < startDate) return;

    try {
      await createRequest.mutateAsync({ type, startDate, endDate, reason });
      onClose();
    } catch (err) {
      console.error('Time-off request failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-semibold text-slate-900">Request Time Off</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TimeOffType)}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="vacation">Vacation</option>
              <option value="sick">Sick</option>
              <option value="personal">Personal</option>
              <option value="unpaid">Unpaid</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (e.target.value > endDate) setEndDate(e.target.value);
              }}
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
            <Input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" isLoading={createRequest.isPending} className="flex-1">
              Submit Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual Entry Modal
// ---------------------------------------------------------------------------

interface ManualEntryModalProps {
  onClose: () => void;
  teamMembers: UserType[];
  currentUserId: string;
}

function ManualEntryModal({ onClose, teamMembers, currentUserId }: ManualEntryModalProps) {
  const createManual = useCreateManualEntry();
  const { data: projects } = useProjects({ status: 'active' });

  const [userId, setUserId] = useState(currentUserId);
  const [projectId, setProjectId] = useState('');
  const [dateStr, setDateStr] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [clockInStr, setClockInStr] = useState('08:00');
  const [clockOutStr, setClockOutStr] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clockInTime = new Date(`${dateStr}T${clockInStr}`);
    const clockOutTime = new Date(`${dateStr}T${clockOutStr}`);

    if (clockOutTime <= clockInTime) return;

    try {
      await createManual.mutateAsync({
        userId,
        projectId: projectId || undefined,
        clockInTime,
        clockOutTime,
        breakMinutes: parseInt(breakMinutes, 10) || 0,
        notes: notes || undefined,
      });
      onClose();
    } catch (err) {
      console.error('Manual entry failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-semibold text-slate-900">Add Manual Entry</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Team member selector */}
          {teamMembers.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Team Member</label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">No project</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          </div>

          {/* Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Clock In</label>
              <Input type="time" value={clockInStr} onChange={(e) => setClockInStr(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Clock Out</label>
              <Input type="time" value={clockOutStr} onChange={(e) => setClockOutStr(e.target.value)} />
            </div>
          </div>

          {/* Break */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Break (minutes)</label>
            <Input
              type="number"
              min="0"
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" isLoading={createManual.isPending} className="flex-1">
              Save Entry
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Team Table Component
// ---------------------------------------------------------------------------

interface TeamTimesheetProps {
  entries: TimeEntry[];
  memberMap: Record<string, string>;
  projectNames: Record<string, string>;
}

function TeamTimesheet({ entries, memberMap, projectNames }: TeamTimesheetProps) {
  const approveEntry = useApproveEntry();
  const rejectEntry = useRejectEntry();

  // Group entries by userId
  const grouped = useMemo(() => {
    const map: Record<string, TimeEntry[]> = {};
    for (const entry of entries) {
      if (!map[entry.userId]) map[entry.userId] = [];
      map[entry.userId].push(entry);
    }
    // Sort groups by member name
    return Object.entries(map).sort(([a], [b]) => {
      const nameA = memberMap[a] || 'Unknown';
      const nameB = memberMap[b] || 'Unknown';
      return nameA.localeCompare(nameB);
    });
  }, [entries, memberMap]);

  if (entries.length === 0) {
    return (
      <p className="text-center text-sm text-slate-400 py-8">
        No team entries for this week.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(([uid, userEntries]) => {
        const totalMinutes = userEntries.reduce(
          (sum, e) => sum + (e.durationMinutes ?? 0),
          0,
        );

        return (
          <div key={uid}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-800">
                {memberMap[uid] || 'Unknown User'}
              </h4>
              <span className="text-xs font-medium text-slate-500">
                Total: {formatDuration(totalMinutes)}
              </span>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Project</th>
                    <th className="py-2 px-3">Clock In</th>
                    <th className="py-2 px-3">Clock Out</th>
                    <th className="py-2 px-3">Duration</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userEntries.map((entry) => {
                    const clockIn = entry.clockInTime?.toDate?.();
                    const dateLabel = clockIn
                      ? clockIn.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
                      : '--';

                    return (
                      <tr key={entry.id} className="border-t border-slate-100">
                        <td className="py-2 px-3 text-slate-700">{dateLabel}</td>
                        <td className="py-2 px-3 text-slate-600">
                          {entry.projectId ? (projectNames[entry.projectId] || 'Unnamed') : '--'}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{formatTime(entry.clockInTime)}</td>
                        <td className="py-2 px-3 text-slate-600">{formatTime(entry.clockOutTime)}</td>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {formatDuration(entry.durationMinutes)}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={cn(
                              'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                              statusConfig[entry.status].classes,
                            )}
                          >
                            {statusConfig[entry.status].label}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {entry.status === 'completed' && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => approveEntry.mutate(entry.id)}
                                disabled={approveEntry.isPending}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                                title="Approve"
                              >
                                <Check className="h-3 w-3" />
                                Approve
                              </button>
                              <button
                                onClick={() => rejectEntry.mutate(entry.id)}
                                disabled={rejectEntry.isPending}
                                className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                                title="Reject"
                              >
                                <Ban className="h-3 w-3" />
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {userEntries.map((entry) => {
                const clockIn = entry.clockInTime?.toDate?.();
                const dateLabel = clockIn
                  ? clockIn.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
                  : '--';

                return (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-600">{dateLabel}</span>
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
                          statusConfig[entry.status].classes,
                        )}
                      >
                        {statusConfig[entry.status].label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>
                        {formatTime(entry.clockInTime)} - {formatTime(entry.clockOutTime)}
                      </span>
                      <span className="font-medium text-slate-900">
                        {formatDuration(entry.durationMinutes)}
                      </span>
                    </div>
                    {entry.status === 'completed' && (
                      <div className="flex gap-2 mt-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => approveEntry.mutate(entry.id)}
                          disabled={approveEntry.isPending}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                        >
                          <Check className="h-3 w-3" />
                          Approve
                        </button>
                        <button
                          onClick={() => rejectEntry.mutate(entry.id)}
                          disabled={rejectEntry.isPending}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          <Ban className="h-3 w-3" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Location Trail Section (expandable per entry)
// ---------------------------------------------------------------------------

function LocationTrailSection({ entry }: { entry: TimeEntry }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasLocation =
    entry.clockInLatitude != null ||
    entry.clockOutLatitude != null ||
    entry.locationTrackingEnabled;

  if (!hasLocation) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
      >
        <MapPin className="h-3.5 w-3.5" />
        View Location Trail
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {isExpanded && (
        <div className="mt-2">
          <LocationMap
            entryId={entry.id}
            isLiveTracking={entry.status === 'active'}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time Entry Card with location (used in "My Time" entries list)
// ---------------------------------------------------------------------------

function TimeEntryLocationRow({ entry, projectName }: { entry: TimeEntry; projectName: string }) {
  return (
    <div className="py-2 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600">
            {formatTime(entry.clockInTime)} - {formatTime(entry.clockOutTime)}
          </span>
          {projectName && (
            <span className="text-xs text-slate-400">{projectName}</span>
          )}
          {/* Small map icon for entries with location data */}
          {(entry.clockInLatitude != null || entry.locationTrackingEnabled) && (
            <MapPin className="h-3 w-3 text-blue-400" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-900">
            {formatDuration(entry.durationMinutes)}
          </span>
          <span
            className={cn(
              'inline-block rounded-full px-2 py-0.5 text-[10px] font-medium',
              statusConfig[entry.status].classes,
            )}
          >
            {statusConfig[entry.status].label}
          </span>
        </div>
      </div>

      {/* Expandable location trail */}
      <LocationTrailSection entry={entry} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Timeclock Page
// ---------------------------------------------------------------------------

type TabKey = 'my' | 'team';

export default function Timeclock() {
  const { user, profile } = useAuthContext();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

  const [tab, setTab] = useState<TabKey>('my');
  const week = useWeekNav();

  // Fetch entries
  const { data: myEntries = [], isLoading: myLoading } = useMyTimeEntries(week.start, week.end);
  const { data: teamEntries = [], isLoading: teamLoading } = useTeamTimeEntries(week.start, week.end);

  // Active entry for live tracking badge
  const { data: activeEntry } = useActiveEntry();

  // Location tracking
  const locationTracking = useLocationTracking();

  // Start/stop location tracking when the active entry changes
  useEffect(() => {
    if (activeEntry?.id && !locationTracking.isTracking) {
      locationTracking.startTracking(activeEntry.id);
    } else if (!activeEntry && locationTracking.isTracking) {
      void locationTracking.stopTracking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntry?.id]);

  // Geofence warning state
  const [geofenceWarning, setGeofenceWarning] = useState<string | null>(null);

  // Clear geofence warning after 10 seconds
  useEffect(() => {
    if (!geofenceWarning) return;
    const t = setTimeout(() => setGeofenceWarning(null), 10_000);
    return () => clearTimeout(t);
  }, [geofenceWarning]);

  // Projects (for name lookup)
  const { data: projects } = useProjects();
  const projectNames = useMemo(() => {
    const map: Record<string, string> = {};
    projects?.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [projects]);

  // Team members (for team tab display + manual entry modal)
  const [teamMembers, setTeamMembers] = useState<UserType[]>([]);

  useEffect(() => {
    if (!profile?.companyId || !isAdmin) return;

    const loadMembers = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('companyId', '==', profile.companyId),
        );
        const snap = await getDocs(q);
        setTeamMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserType)));
      } catch (err) {
        console.error('Error loading team members:', err);
      }
    };

    loadMembers();
  }, [profile?.companyId, isAdmin]);

  const memberMap = useMemo(() => {
    const map: Record<string, string> = {};
    teamMembers.forEach((m) => {
      map[m.id] = m.fullName;
    });
    return map;
  }, [teamMembers]);

  // Manual entry modal state
  const [showManualModal, setShowManualModal] = useState(false);

  // Time-off request state
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const { data: myTimeOffRequests = [], isLoading: timeOffLoading } = useMyTimeOffRequests();

  return (
    <div className="pb-20 sm:pb-6">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Timeclock</h1>
        <Button size="sm" variant="outline" onClick={() => setShowTimeOffModal(true)}>
          <CalendarDays className="h-4 w-4" />
          Request Time Off
        </Button>
      </div>

      {/* Clock In / Out Card */}
      <div className="px-4">
        <Card>
          <CardContent className="pt-4">
            <ClockInOut />

            {/* Live Location Badge — shown when clocked in */}
            {activeEntry && (
              <div className="mt-3 flex justify-center">
                <LiveLocationBadge
                  isTracking={locationTracking.isTracking}
                  lastLocation={locationTracking.lastLocation}
                  error={locationTracking.error}
                />
              </div>
            )}

            {/* Geofence warning */}
            {geofenceWarning && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
                {geofenceWarning}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tab Toggle + Week Nav */}
      <div className="px-4 mt-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 mb-4">
          <button
            onClick={() => setTab('my')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              tab === 'my'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Clock className="h-4 w-4" />
            My Time
          </button>
          {isAdmin && (
            <button
              onClick={() => setTab('team')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                tab === 'team'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <Users className="h-4 w-4" />
              Team
            </button>
          )}
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={week.goToPrev}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <span className="text-sm font-medium text-slate-700">{week.label}</span>
          <button
            onClick={week.goToNext}
            disabled={week.isCurrentWeek}
            className={cn(
              'p-2 rounded-lg transition-colors',
              week.isCurrentWeek
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-slate-100',
            )}
            aria-label="Next week"
          >
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        {tab === 'my' && (
          <>
            <Card>
              <CardContent className="pt-4">
                {myLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <WeeklyTimesheet
                    entries={myEntries}
                    weekStart={week.start}
                    projectNames={projectNames}
                  />
                )}
              </CardContent>
            </Card>

            {/* Location history entries (below the weekly sheet) */}
            {!myLoading && myEntries.length > 0 && (
              <Card className="mt-4">
                <CardContent className="pt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    Location History
                  </h3>
                  {myEntries.map((entry) => (
                    <TimeEntryLocationRow
                      key={entry.id}
                      entry={entry}
                      projectName={
                        entry.projectId
                          ? (projectNames[entry.projectId] || 'Unnamed')
                          : ''
                      }
                    />
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {tab === 'team' && isAdmin && (
          <>
            {/* Add Manual Entry button */}
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => setShowManualModal(true)}>
                <Plus className="h-4 w-4" />
                Add Manual Entry
              </Button>
            </div>

            <Card>
              <CardContent className="pt-4">
                {teamLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <TeamTimesheet
                    entries={teamEntries}
                    memberMap={memberMap}
                    projectNames={projectNames}
                  />
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Time Off Requests Section */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Time Off Requests
          </h2>

          {timeOffLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : myTimeOffRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-sm text-slate-400">
                  No time-off requests yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {myTimeOffRequests.map((req) => (
                <Card key={req.id}>
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                              timeOffTypeConfig[req.type].classes,
                            )}
                          >
                            {timeOffTypeConfig[req.type].label}
                          </span>
                          <span
                            className={cn(
                              'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                              timeOffStatusConfig[req.status].classes,
                            )}
                          >
                            {timeOffStatusConfig[req.status].label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                          {formatDateRange(req.startDate, req.endDate)}
                        </p>
                        {req.reason && (
                          <p className="mt-0.5 text-xs text-slate-500 truncate">
                            {req.reason}
                          </p>
                        )}
                        {req.reviewNote && (
                          <p className="mt-0.5 text-xs text-slate-400 italic truncate">
                            Note: {req.reviewNote}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual Entry Modal */}
      {showManualModal && user && (
        <ManualEntryModal
          onClose={() => setShowManualModal(false)}
          teamMembers={teamMembers.length > 0 ? teamMembers : []}
          currentUserId={user.uid}
        />
      )}

      {/* Request Time Off Modal */}
      {showTimeOffModal && (
        <RequestTimeOffModal onClose={() => setShowTimeOffModal(false)} />
      )}
    </div>
  );
}
