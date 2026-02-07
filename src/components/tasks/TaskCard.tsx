'use client';

import { useState, useMemo } from 'react';
import {
  Circle,
  CheckCircle2,
  CalendarDays,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn, getInitials, formatDate } from '@/lib/utils';
import type { Task, TaskPriority, TaskStatus } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onClick?: (taskId: string) => void;
  assigneeName?: string;
  assigneeAvatar?: string;
  showProject?: boolean;
  projectName?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_BORDER: Record<TaskPriority, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-blue-500',
  low: 'border-l-slate-400',
};

const PRIORITY_BADGE: Record<TaskPriority, { bg: string; text: string; label: string }> = {
  urgent: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgent' },
  high: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Medium' },
  low: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Low' },
};

const STATUS_BADGE: Record<TaskStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
};

function isOverdue(dueDate: string | undefined, status: TaskStatus): boolean {
  if (!dueDate || status === 'completed') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TaskCard({
  task,
  onComplete,
  onDelete,
  onClick,
  assigneeName,
  assigneeAvatar,
  showProject = false,
  projectName,
}: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isCompleted = task.status === 'completed';
  const overdue = useMemo(
    () => isOverdue(task.dueDate, task.status),
    [task.dueDate, task.status]
  );
  const priorityBadge = PRIORITY_BADGE[task.priority];
  const statusBadge = STATUS_BADGE[task.status];

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCompleted) {
      onComplete(task.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(task.id);
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(task.id);
    } else {
      setIsExpanded((prev) => !prev);
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card
      className={cn(
        'border-l-4 transition-all duration-150',
        PRIORITY_BORDER[task.priority],
        isCompleted && 'opacity-60'
      )}
    >
      <button
        type="button"
        onClick={handleCardClick}
        className="w-full text-left p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 rounded-xl"
        aria-expanded={isExpanded}
      >
        {/* ---- Top row: checkbox, title, priority badge ---- */}
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            type="button"
            onClick={handleToggleComplete}
            className={cn(
              'shrink-0 mt-0.5 touch-manipulation rounded-full',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
              isCompleted
                ? 'text-green-500'
                : 'text-slate-400 hover:text-blue-500 active:text-blue-600'
            )}
            aria-label={isCompleted ? 'Task completed' : 'Mark task complete'}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-8 w-8" />
            ) : (
              <Circle className="h-8 w-8" />
            )}
          </button>

          {/* Title + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  'text-base font-semibold text-slate-900 break-words',
                  isCompleted && 'line-through text-slate-500'
                )}
              >
                {task.title}
              </span>

              <span
                className={cn(
                  'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  priorityBadge.bg,
                  priorityBadge.text
                )}
              >
                {priorityBadge.label}
              </span>
            </div>

            {/* ---- Second row: assignee, due date, status ---- */}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500">
              {/* Assignee */}
              {assigneeName && (
                <div className="flex items-center gap-1.5">
                  {assigneeAvatar ? (
                    <img
                      src={assigneeAvatar}
                      alt={assigneeName}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-600">
                      {getInitials(assigneeName)}
                    </span>
                  )}
                  <span className="truncate max-w-[120px]">{assigneeName}</span>
                </div>
              )}

              {/* Due date */}
              {task.dueDate && (
                <div
                  className={cn(
                    'flex items-center gap-1',
                    overdue ? 'text-red-600 font-medium' : 'text-slate-500'
                  )}
                >
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span>{formatDate(task.dueDate)}</span>
                </div>
              )}

              {/* Status badge */}
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                  statusBadge.bg,
                  statusBadge.text
                )}
              >
                {statusBadge.label}
              </span>

              {/* Project name */}
              {showProject && projectName && (
                <span className="text-xs text-slate-400 truncate max-w-[140px]">
                  {projectName}
                </span>
              )}
            </div>
          </div>

          {/* Expand / collapse chevron */}
          {(task.description || true) && (
            <button
              type="button"
              onClick={handleToggleExpand}
              className="shrink-0 mt-0.5 p-1 rounded-full text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </button>

      {/* ---- Expandable section ---- */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100 mt-0">
          <div className="pt-3 pl-11 space-y-3">
            {/* Description */}
            {task.description ? (
              <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                {task.description}
              </p>
            ) : (
              <p className="text-sm text-slate-400 italic">No description</p>
            )}

            {/* Delete action */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
