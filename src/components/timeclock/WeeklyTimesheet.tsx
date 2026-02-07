import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { TimeEntry } from '@/types';
import type { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WeeklyTimesheetProps {
  entries: TimeEntry[];
  weekStart: Date;
  /** Optional map of projectId -> project name for display. */
  projectNames?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(ts: Timestamp | undefined): string {
  if (!ts) return '--:--';
  const d = ts.toDate();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number | undefined): string {
  if (minutes == null || minutes <= 0) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

type StatusKey = TimeEntry['status'];

const statusConfig: Record<StatusKey, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', classes: 'bg-slate-100 text-slate-700' },
  approved: { label: 'Approved', classes: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', classes: 'bg-red-100 text-red-700' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WeeklyTimesheet({ entries, weekStart, projectNames }: WeeklyTimesheetProps) {
  // Build array of 7 days starting from weekStart (Monday)
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  // Group entries by date key
  const entriesByDate = useMemo(() => {
    const map: Record<string, TimeEntry[]> = {};
    for (const entry of entries) {
      const clockIn = entry.clockInTime?.toDate?.();
      if (!clockIn) continue;
      const key = toDateKey(clockIn);
      if (!map[key]) map[key] = [];
      map[key].push(entry);
    }
    return map;
  }, [entries]);

  // Total minutes (excluding breaks)
  const weeklyTotalMinutes = useMemo(() => {
    let total = 0;
    for (const entry of entries) {
      if (entry.durationMinutes != null) {
        total += entry.durationMinutes;
      }
    }
    return total;
  }, [entries]);

  // ---------------------------------------------------------------------------
  // CSV Export
  // ---------------------------------------------------------------------------

  const handleExportCSV = () => {
    const rows: string[][] = [
      ['Date', 'Day', 'Project', 'Clock In', 'Clock Out', 'Break (min)', 'Duration', 'Status'],
    ];

    for (const day of weekDays) {
      const key = toDateKey(day);
      const dayEntries = entriesByDate[key] || [];

      if (dayEntries.length === 0) {
        rows.push([
          formatShortDate(day),
          DAY_LABELS[day.getDay() === 0 ? 6 : day.getDay() - 1],
          '',
          '',
          '',
          '',
          '',
          '',
        ]);
      } else {
        for (const entry of dayEntries) {
          const projectName = entry.projectId && projectNames?.[entry.projectId]
            ? projectNames[entry.projectId]
            : '';
          rows.push([
            formatShortDate(day),
            DAY_LABELS[day.getDay() === 0 ? 6 : day.getDay() - 1],
            projectName,
            formatTime(entry.clockInTime),
            formatTime(entry.clockOutTime),
            String(entry.breakMinutes ?? 0),
            formatDuration(entry.durationMinutes),
            entry.status,
          ]);
        }
      }
    }

    rows.push([]);
    rows.push(['', '', '', '', '', 'Total', formatDuration(weeklyTotalMinutes), '']);

    const csvContent = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const weekLabel = formatShortDate(weekStart).replace(/\s/g, '');
    link.download = `timesheet-${weekLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      {/* Desktop / wide-screen table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3">Project</th>
              <th className="py-2 px-3">Clock In</th>
              <th className="py-2 px-3">Clock Out</th>
              <th className="py-2 px-3">Break</th>
              <th className="py-2 px-3">Duration</th>
              <th className="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {weekDays.map((day, dayIdx) => {
              const key = toDateKey(day);
              const dayEntries = entriesByDate[key] || [];
              const dayLabel = DAY_LABELS[dayIdx];
              const isToday = toDateKey(new Date()) === key;

              if (dayEntries.length === 0) {
                return (
                  <tr
                    key={key}
                    className={cn(
                      'border-b border-slate-100',
                      isToday && 'bg-blue-50/50',
                    )}
                  >
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      <span>{dayLabel}</span>
                      <span className="ml-1.5 text-slate-400">{formatShortDate(day)}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400" colSpan={6}>
                      No entries
                    </td>
                  </tr>
                );
              }

              return dayEntries.map((entry, entryIdx) => (
                <tr
                  key={entry.id}
                  className={cn(
                    'border-b border-slate-100',
                    isToday && 'bg-blue-50/50',
                  )}
                >
                  <td className="py-2.5 px-3 font-medium text-slate-700">
                    {entryIdx === 0 && (
                      <>
                        <span>{dayLabel}</span>
                        <span className="ml-1.5 text-slate-400">{formatShortDate(day)}</span>
                      </>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {entry.projectId && projectNames?.[entry.projectId]
                      ? projectNames[entry.projectId]
                      : entry.projectId
                        ? 'Unnamed project'
                        : '--'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{formatTime(entry.clockInTime)}</td>
                  <td className="py-2.5 px-3 text-slate-600">{formatTime(entry.clockOutTime)}</td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {entry.breakMinutes ? `${entry.breakMinutes}m` : '--'}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">
                    {formatDuration(entry.durationMinutes)}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                        statusConfig[entry.status].classes,
                      )}
                    >
                      {statusConfig[entry.status].label}
                    </span>
                  </td>
                </tr>
              ));
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200">
              <td className="py-3 px-3 font-semibold text-slate-900" colSpan={5}>
                Weekly Total
              </td>
              <td className="py-3 px-3 font-bold text-slate-900">
                {formatDuration(weeklyTotalMinutes)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile card layout */}
      <div className="sm:hidden space-y-3">
        {weekDays.map((day, dayIdx) => {
          const key = toDateKey(day);
          const dayEntries = entriesByDate[key] || [];
          const dayLabel = DAY_LABELS[dayIdx];
          const isToday = toDateKey(new Date()) === key;

          return (
            <div
              key={key}
              className={cn(
                'rounded-lg border border-slate-200 p-3',
                isToday && 'border-blue-300 bg-blue-50/40',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-800">
                  {dayLabel}, {formatShortDate(day)}
                </span>
                {dayEntries.length === 0 && (
                  <span className="text-xs text-slate-400">No entries</span>
                )}
              </div>
              {dayEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-1.5 border-t border-slate-100 first:border-t-0 first:pt-0"
                >
                  <div className="text-xs text-slate-600">
                    <span>{formatTime(entry.clockInTime)}</span>
                    <span className="mx-1">-</span>
                    <span>{formatTime(entry.clockOutTime)}</span>
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
              ))}
            </div>
          );
        })}

        {/* Mobile total */}
        <div className="rounded-lg bg-slate-100 px-3 py-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Weekly Total</span>
          <span className="text-sm font-bold text-slate-900">
            {formatDuration(weeklyTotalMinutes)}
          </span>
        </div>
      </div>

      {/* Export button */}
      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>
    </div>
  );
}
