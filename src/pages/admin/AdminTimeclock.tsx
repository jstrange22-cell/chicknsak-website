import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Check,
  Ban,
  Download,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/utils';
import {
  getWeekRange,
  useTeamTimeEntries,
  useApproveTimeEntry,
  useRejectTimeEntry,
} from '@/hooks/useTimeEntries';
import type { TimeEntry, User as UserType } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeekLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString([], opts);
  const endStr = end.toLocaleDateString([], opts);
  return `${startStr} - ${endStr}`;
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

function formatDateLabel(ts: { toDate: () => Date } | undefined): string {
  if (!ts) return '--';
  return ts.toDate().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

const statusConfig: Record<TimeEntry['status'], { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Pending', classes: 'bg-amber-100 text-amber-700' },
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
// CSV Export
// ---------------------------------------------------------------------------

function exportToCSV(entries: TimeEntry[], memberMap: Record<string, string>) {
  const headers = ['Employee', 'Date', 'Clock In', 'Clock Out', 'Duration (min)', 'Break (min)', 'Status', 'Notes'];
  const rows = entries.map((e) => [
    memberMap[e.userId] || 'Unknown',
    formatDateLabel(e.clockInTime),
    formatTime(e.clockInTime),
    formatTime(e.clockOutTime),
    String(e.durationMinutes ?? 0),
    String(e.breakMinutes ?? 0),
    e.status,
    e.notes || '',
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `timeclock-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Excel (XLSX) Export
// ---------------------------------------------------------------------------

function exportToExcel(entries: TimeEntry[], memberMap: Record<string, string>) {
  const headers = ['Employee', 'Date', 'Clock In', 'Clock Out', 'Duration (hrs)', 'Break (min)', 'Status', 'Notes'];

  const rows = entries.map((e) => {
    const durationHrs = e.durationMinutes != null ? Math.round((e.durationMinutes / 60) * 100) / 100 : 0;
    return [
      memberMap[e.userId] || 'Unknown',
      formatDateLabel(e.clockInTime),
      formatTime(e.clockInTime),
      formatTime(e.clockOutTime),
      durationHrs,
      e.breakMinutes ?? 0,
      e.status,
      e.notes || '',
    ];
  });

  // Calculate totals for the summary row
  const totalHours = entries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0) / 60;
  const totalBreakMin = entries.reduce((sum, e) => sum + (e.breakMinutes ?? 0), 0);
  const summaryRow = [
    'TOTAL',
    '',
    '',
    '',
    Math.round(totalHours * 100) / 100,
    totalBreakMin,
    '',
    `${entries.length} entries`,
  ];

  // Build worksheet data: headers + data rows + blank row + summary
  const wsData = [headers, ...rows, [], summaryRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // ----- Style header row (bold via cell formatting) -----
  const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E293B' } },
        alignment: { horizontal: 'center' },
      };
    }
  }

  // ----- Style summary row (bold) -----
  const summaryRowIdx = rows.length + 2; // headers(0) + data rows + 1 blank row
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: summaryRowIdx, c: col });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: 'F1F5F9' } },
      };
    }
  }

  // ----- Auto-size columns -----
  const colWidths = headers.map((h, i) => {
    let maxLen = h.length;
    rows.forEach((row) => {
      const cellLen = String(row[i] ?? '').length;
      if (cellLen > maxLen) maxLen = cellLen;
    });
    // summary row
    const summaryLen = String(summaryRow[i] ?? '').length;
    if (summaryLen > maxLen) maxLen = summaryLen;
    return { wch: Math.min(maxLen + 3, 40) };
  });
  ws['!cols'] = colWidths;

  // ----- Number format for duration & break columns -----
  rows.forEach((_, rowIdx) => {
    // Duration (hrs) is column index 4
    const durCell = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 4 });
    if (ws[durCell]) {
      ws[durCell].z = '0.00';
    }
    // Break (min) is column index 5
    const brkCell = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 5 });
    if (ws[brkCell]) {
      ws[brkCell].z = '0';
    }
  });

  // Create workbook and trigger download
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Timeclock');
  XLSX.writeFile(wb, `timeclock-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ---------------------------------------------------------------------------
// AdminTimeclock Component
// ---------------------------------------------------------------------------

export default function AdminTimeclock() {
  const { profile } = useAuthContext();
  const week = useWeekNav();
  const approveEntry = useApproveTimeEntry();
  const rejectEntry = useRejectTimeEntry();

  const { data: entries = [], isLoading } = useTeamTimeEntries(week.start, week.end);

  // Load team members
  const [teamMembers, setTeamMembers] = useState<UserType[]>([]);

  useEffect(() => {
    if (!profile?.companyId) return;

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
  }, [profile?.companyId]);

  const memberMap = useMemo(() => {
    const map: Record<string, string> = {};
    teamMembers.forEach((m) => {
      map[m.id] = m.fullName;
    });
    return map;
  }, [teamMembers]);

  // Filters
  const [filterUser, setFilterUser] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (filterUser !== 'all') {
      result = result.filter((e) => e.userId === filterUser);
    }
    if (filterStatus !== 'all') {
      result = result.filter((e) => e.status === filterStatus);
    }
    return result;
  }, [entries, filterUser, filterStatus]);

  // Summary stats
  const stats = useMemo(() => {
    const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes ?? 0), 0);
    const pendingCount = entries.filter((e) => e.status === 'completed').length;
    const overtimeEntries = entries.filter((e) => (e.durationMinutes ?? 0) > 480);
    return {
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
      pendingCount,
      overtimeCount: overtimeEntries.length,
      totalEntries: entries.length,
    };
  }, [entries]);

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Hours</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalHours}h</p>
          <p className="text-xs text-slate-400">This week</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Approvals</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{stats.pendingCount}</p>
          <p className="text-xs text-slate-400">Needs review</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Overtime Alerts</p>
          <p className={cn('mt-1 text-2xl font-bold', stats.overtimeCount > 0 ? 'text-red-600' : 'text-slate-900')}>
            {stats.overtimeCount}
          </p>
          <p className="text-xs text-slate-400">Entries &gt; 8 hours</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Entries</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.totalEntries}</p>
          <p className="text-xs text-slate-400">This week</p>
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {/* Week Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={week.goToPrev}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">{week.label}</span>
          </div>
          <button
            onClick={week.goToNext}
            disabled={week.isCurrentWeek}
            className={cn(
              'p-2 rounded-lg transition-colors',
              week.isCurrentWeek ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-100',
            )}
            aria-label="Next week"
          >
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              showFilters ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <button
            onClick={() => exportToExcel(filteredEntries, memberMap)}
            disabled={filteredEntries.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </button>
          <button
            onClick={() => exportToCSV(filteredEntries, memberMap)}
            disabled={filteredEntries.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Employee</label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="all">All employees</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Clock className="h-10 w-10 mb-2" />
            <p className="text-sm">No time entries found for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Clock In</th>
                  <th className="py-3 px-4">Clock Out</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Break</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry) => {
                  const isOvertime = (entry.durationMinutes ?? 0) > 480;

                  return (
                    <tr
                      key={entry.id}
                      className={cn(
                        'hover:bg-slate-50 transition-colors',
                        isOvertime && 'bg-red-50/50',
                      )}
                    >
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {memberMap[entry.userId] || 'Unknown'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatDateLabel(entry.clockInTime)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatTime(entry.clockInTime)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {formatTime(entry.clockOutTime)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <span className={cn('font-medium', isOvertime ? 'text-red-700' : 'text-slate-900')}>
                            {formatDuration(entry.durationMinutes)}
                          </span>
                          {isOvertime && (
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {entry.breakMinutes > 0 ? `${entry.breakMinutes}m` : '--'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                            statusConfig[entry.status].classes,
                          )}
                        >
                          {statusConfig[entry.status].label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate">
                        {entry.notes || '--'}
                      </td>
                      <td className="py-3 px-4">
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
        )}
      </div>
    </div>
  );
}
