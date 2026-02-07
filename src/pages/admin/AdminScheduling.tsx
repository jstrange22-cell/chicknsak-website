import { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Ban,
  Loader2,
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
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import {
  useAllTimeOffRequests,
  useReviewTimeOffRequest,
} from '@/hooks/useTimeOffRequests';
import type { TimeOffRequest, TimeOffType, User as UserType } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const typeColorMap: Record<TimeOffType, { bg: string; text: string; border: string }> = {
  vacation: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  sick: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  personal: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  unpaid: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  other: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
};

const typeLabels: Record<TimeOffType, string> = {
  vacation: 'Vacation',
  sick: 'Sick',
  personal: 'Personal',
  unpaid: 'Unpaid',
  other: 'Other',
};

const statusConfig: Record<TimeOffRequest['status'], { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', classes: 'bg-emerald-100 text-emerald-700' },
  denied: { label: 'Denied', classes: 'bg-red-100 text-red-700' },
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (start === end) return s.toLocaleDateString([], opts);
  return `${s.toLocaleDateString([], opts)} - ${e.toLocaleDateString([], opts)}`;
}

// Check if a given date string falls within a request's date range
function isDateInRange(dateStr: string, request: TimeOffRequest): boolean {
  return dateStr >= request.startDate && dateStr <= request.endDate;
}

// ---------------------------------------------------------------------------
// Review Modal
// ---------------------------------------------------------------------------

interface ReviewModalProps {
  request: TimeOffRequest;
  memberName: string;
  onClose: () => void;
}

function ReviewModal({ request, memberName, onClose }: ReviewModalProps) {
  const reviewMutation = useReviewTimeOffRequest();
  const [reviewNote, setReviewNote] = useState('');

  const handleReview = async (status: 'approved' | 'denied') => {
    try {
      await reviewMutation.mutateAsync({ id: request.id, status, reviewNote });
      onClose();
    } catch (err) {
      console.error('Review failed:', err);
    }
  };

  const colors = typeColorMap[request.type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-semibold text-slate-900">Review Time-Off Request</h3>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-slate-700">{memberName}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', colors.bg, colors.text)}>
                {typeLabels[request.type]}
              </span>
              <span className="text-sm text-slate-600">
                {formatDateRange(request.startDate, request.endDate)}
              </span>
            </div>
            {request.reason && (
              <p className="mt-2 text-sm text-slate-600">{request.reason}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Review Note (optional)</label>
            <Textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Add a note..."
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => handleReview('denied')}
              isLoading={reviewMutation.isPending}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white"
            >
              <Ban className="h-4 w-4" />
              Deny
            </Button>
            <Button
              type="button"
              onClick={() => handleReview('approved')}
              isLoading={reviewMutation.isPending}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Check className="h-4 w-4" />
              Approve
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar Day Cell
// ---------------------------------------------------------------------------

interface DayCellProps {
  day: number;
  dateStr: string;
  requests: TimeOffRequest[];
  memberMap: Record<string, string>;
  isToday: boolean;
  isCurrentMonth: boolean;
  onRequestClick: (req: TimeOffRequest) => void;
}

function DayCell({ day, dateStr, requests, memberMap, isToday, isCurrentMonth, onRequestClick }: DayCellProps) {
  const dayRequests = requests.filter((r) => isDateInRange(dateStr, r));

  return (
    <div
      className={cn(
        'min-h-[80px] sm:min-h-[100px] border border-slate-100 p-1',
        !isCurrentMonth && 'bg-slate-50/50',
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center text-xs font-medium w-6 h-6 rounded-full',
          isToday && 'bg-blue-500 text-white',
          !isToday && isCurrentMonth && 'text-slate-700',
          !isToday && !isCurrentMonth && 'text-slate-300',
        )}
      >
        {day}
      </span>

      <div className="mt-0.5 space-y-0.5">
        {dayRequests.slice(0, 3).map((req) => {
          const colors = typeColorMap[req.type];
          const name = memberMap[req.userId] || 'Unknown';
          const firstName = name.split(' ')[0];

          return (
            <button
              key={req.id}
              onClick={() => onRequestClick(req)}
              className={cn(
                'w-full truncate rounded px-1 py-0.5 text-[10px] sm:text-xs font-medium text-left leading-tight',
                req.status === 'pending'
                  ? 'bg-yellow-50 text-yellow-700 border border-dashed border-yellow-300'
                  : cn(colors.bg, colors.text),
              )}
              title={`${name} - ${typeLabels[req.type]} (${req.status})`}
            >
              {firstName} - {typeLabels[req.type]}
            </button>
          );
        })}
        {dayRequests.length > 3 && (
          <p className="text-[10px] text-slate-400 pl-1">
            +{dayRequests.length - 3} more
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main AdminScheduling Component
// ---------------------------------------------------------------------------

export default function AdminScheduling() {
  const { profile } = useAuthContext();

  // Month navigation
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Data
  const { data: allRequests = [], isLoading } = useAllTimeOffRequests();

  // Team members
  const [memberMap, setMemberMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile?.companyId) return;
    const loadMembers = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('companyId', '==', profile.companyId),
        );
        const snap = await getDocs(q);
        const map: Record<string, string> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as UserType;
          map[d.id] = data.fullName;
        });
        setMemberMap(map);
      } catch (err) {
        console.error('Error loading team members:', err);
      }
    };
    loadMembers();
  }, [profile?.companyId]);

  // Filter requests that overlap with the current month
  const monthRequests = useMemo(() => {
    const monthStart = toDateStr(year, month, 1);
    const monthEnd = toDateStr(year, month, getDaysInMonth(year, month));
    return allRequests.filter(
      (r) => r.startDate <= monthEnd && r.endDate >= monthStart,
    );
  }, [allRequests, year, month]);

  // Pending requests
  const pendingRequests = useMemo(
    () => allRequests.filter((r) => r.status === 'pending'),
    [allRequests],
  );

  // Review modal
  const [reviewRequest, setReviewRequest] = useState<TimeOffRequest | null>(null);

  // Calendar grid
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  // Build grid rows
  const calendarDays = useMemo(() => {
    const days: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Previous month fill
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      days.push({
        day: d,
        dateStr: toDateStr(prevYear, prevMonth, d),
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        dateStr: toDateStr(year, month, d),
        isCurrentMonth: true,
      });
    }

    // Next month fill
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        days.push({
          day: d,
          dateStr: toDateStr(nextYear, nextMonth, d),
          isCurrentMonth: false,
        });
      }
    }

    return days;
  }, [year, month, daysInMonth, firstDay]);

  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <CalendarDays className="h-6 w-6 text-blue-500" />
        <h2 className="text-xl font-bold text-slate-900">Scheduling</h2>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5 text-slate-600" />
        </button>
        <h3 className="text-lg font-semibold text-slate-800">
          {formatMonthYear(year, month)}
        </h3>
        <button
          onClick={goToNextMonth}
          className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5 text-slate-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-6">
        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {dayHeaders.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Day Cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((cell, idx) => (
            <DayCell
              key={idx}
              day={cell.day}
              dateStr={cell.dateStr}
              requests={monthRequests}
              memberMap={memberMap}
              isToday={cell.dateStr === todayStr}
              isCurrentMonth={cell.isCurrentMonth}
              onRequestClick={(req) => setReviewRequest(req)}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        {(Object.keys(typeColorMap) as TimeOffType[]).map((type) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className={cn('w-3 h-3 rounded-sm', typeColorMap[type].bg, typeColorMap[type].border, 'border')} />
            <span className="text-xs text-slate-600">{typeLabels[type]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-yellow-50 border border-dashed border-yellow-300" />
          <span className="text-xs text-slate-600">Pending</span>
        </div>
      </div>

      {/* Pending Requests */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          Pending Requests
          {pendingRequests.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
              {pendingRequests.length}
            </span>
          )}
        </h3>

        {pendingRequests.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-8">
            <p className="text-center text-sm text-slate-400">
              No pending requests.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingRequests.map((req) => {
              const colors = typeColorMap[req.type];
              const name = memberMap[req.userId] || 'Unknown User';

              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{name}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          colors.bg,
                          colors.text,
                        )}
                      >
                        {typeLabels[req.type]}
                      </span>
                      <span className="text-sm text-slate-600">
                        {formatDateRange(req.startDate, req.endDate)}
                      </span>
                    </div>
                    {req.reason && (
                      <p className="mt-1 text-xs text-slate-500 truncate">{req.reason}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setReviewRequest(req)}
                    >
                      Review
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All Requests Table (non-pending) */}
      {allRequests.filter((r) => r.status !== 'pending').length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">
            Reviewed Requests
          </h3>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="py-2 px-3">Employee</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Dates</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {allRequests
                    .filter((r) => r.status !== 'pending')
                    .map((req) => {
                      const colors = typeColorMap[req.type];
                      return (
                        <tr key={req.id} className="border-t border-slate-100">
                          <td className="py-2 px-3 text-slate-700">
                            {memberMap[req.userId] || 'Unknown'}
                          </td>
                          <td className="py-2 px-3">
                            <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', colors.bg, colors.text)}>
                              {typeLabels[req.type]}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {formatDateRange(req.startDate, req.endDate)}
                          </td>
                          <td className="py-2 px-3">
                            <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-medium', statusConfig[req.status].classes)}>
                              {statusConfig[req.status].label}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-500 text-xs truncate max-w-[200px]">
                            {req.reviewNote || '--'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {allRequests
                .filter((r) => r.status !== 'pending')
                .map((req) => {
                  const colors = typeColorMap[req.type];
                  return (
                    <div key={req.id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-800">
                          {memberMap[req.userId] || 'Unknown'}
                        </span>
                        <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', statusConfig[req.status].classes)}>
                          {statusConfig[req.status].label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-medium', colors.bg, colors.text)}>
                          {typeLabels[req.type]}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDateRange(req.startDate, req.endDate)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewRequest && reviewRequest.status === 'pending' && (
        <ReviewModal
          request={reviewRequest}
          memberName={memberMap[reviewRequest.userId] || 'Unknown User'}
          onClose={() => setReviewRequest(null)}
        />
      )}
    </div>
  );
}
