'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import type { TaskPriority } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    assignedTo?: string;
    priority: TaskPriority;
    dueDate?: string;
    photoId?: string;
  }) => void;
  isSubmitting?: boolean;
  projectId: string;
  teamMembers?: Array<{ id: string; fullName: string; avatarUrl?: string }>;
  defaultPhotoId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_OPTIONS: {
  value: TaskPriority;
  label: string;
  activeClasses: string;
}[] = [
  {
    value: 'low',
    label: 'Low',
    activeClasses: 'bg-slate-200 text-slate-800 border-slate-300',
  },
  {
    value: 'medium',
    label: 'Medium',
    activeClasses: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  {
    value: 'high',
    label: 'High',
    activeClasses: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    activeClasses: 'bg-red-100 text-red-800 border-red-300',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  projectId: _projectId,
  teamMembers = [],
  defaultPhotoId,
}: CreateTaskModalProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [titleError, setTitleError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setPriority('medium');
      setDueDate('');
      setTitleError('');
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Title is required');
      return;
    }

    setTitleError('');

    onSubmit({
      title: trimmedTitle,
      description: description.trim() || undefined,
      assignedTo: assignedTo || undefined,
      priority,
      dueDate: dueDate || undefined,
      photoId: defaultPhotoId,
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 sm:block hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className={cn(
          'relative z-10 flex flex-col bg-white w-full max-h-full overflow-hidden',
          // Mobile: full-screen sheet
          'h-full',
          // Desktop: centered card
          'sm:h-auto sm:max-w-lg sm:rounded-2xl sm:shadow-xl sm:mx-4'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Create new task"
      >
        {/* ---- Header ---- */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">New Task</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="h-10 w-10 -mr-2"
          >
            <X className="h-5 w-5 text-slate-500" />
          </Button>
        </div>

        {/* ---- Body (scrollable) ---- */}
        <form
          id="create-task-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-5"
        >
          {/* Title */}
          <div className="space-y-1.5">
            <label
              htmlFor="task-title"
              className="block text-sm font-medium text-slate-700"
            >
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              id="task-title"
              placeholder="Task title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError('');
              }}
              error={titleError || undefined}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="task-description"
              className="block text-sm font-medium text-slate-700"
            >
              Description
            </label>
            <Textarea
              id="task-description"
              placeholder="Add description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none rounded-lg border-slate-300 focus-visible:ring-blue-500"
            />
          </div>

          {/* Assign to */}
          <div className="space-y-1.5">
            <label
              htmlFor="task-assignee"
              className="block text-sm font-medium text-slate-700"
            >
              Assign to
            </label>
            <div className="relative">
              <select
                id="task-assignee"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className={cn(
                  'flex h-12 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                  !assignedTo && 'text-slate-400'
                )}
              >
                <option value="">Unassigned</option>
                {teamMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-slate-700">
              Priority
            </span>
            <div
              className="grid grid-cols-4 gap-2"
              role="radiogroup"
              aria-label="Task priority"
            >
              {PRIORITY_OPTIONS.map((opt) => {
                const isActive = priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setPriority(opt.value)}
                    className={cn(
                      'h-10 rounded-lg border text-sm font-medium transition-colors touch-manipulation',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                      isActive
                        ? opt.activeClasses
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <label
              htmlFor="task-due-date"
              className="block text-sm font-medium text-slate-700"
            >
              Due date
            </label>
            <Input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </form>

        {/* ---- Footer ---- */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-200 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-task-form"
            className="flex-1"
            isLoading={isSubmitting}
          >
            Create Task
          </Button>
        </div>
      </div>
    </div>
  );
}
