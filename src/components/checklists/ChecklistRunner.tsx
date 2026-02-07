'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Camera,
  Star,
  PenLine,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { ChecklistItem, ChecklistFieldType } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChecklistRunnerProps {
  checklist: {
    id: string;
    name: string;
    status: string;
    projectId: string;
  };
  items: ChecklistItem[];
  onUpdateItem: (itemId: string, updates: Partial<ChecklistItem>) => void;
  onComplete: () => void;
  onBack: () => void;
  projectName?: string;
  isCompleting?: boolean;
}

// ---------------------------------------------------------------------------
// Section grouping helper
// ---------------------------------------------------------------------------

interface Section {
  name: string;
  items: ChecklistItem[];
}

function groupBySection(items: ChecklistItem[]): Section[] {
  const map = new Map<string, ChecklistItem[]>();
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const item of sorted) {
    const key = item.sectionName ?? '__default__';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(item);
  }

  return Array.from(map.entries()).map(([name, sectionItems]) => ({
    name: name === '__default__' ? 'General' : name,
    items: sectionItems,
  }));
}

// ---------------------------------------------------------------------------
// Field renderers
// ---------------------------------------------------------------------------

interface FieldRendererProps {
  item: ChecklistItem;
  onUpdate: (updates: Partial<ChecklistItem>) => void;
}

function CheckboxField({ item, onUpdate }: FieldRendererProps) {
  const toggle = () => {
    const next = !item.completed;
    onUpdate({
      completed: next,
      value: next ? 'checked' : '',
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center justify-center w-12 h-12 rounded-lg transition-colors hover:bg-slate-100 active:bg-slate-200"
      aria-label={item.completed ? 'Mark as incomplete' : 'Mark as complete'}
    >
      {item.completed ? (
        <CheckCircle2 className="w-7 h-7 text-emerald-500" />
      ) : (
        <Circle className="w-7 h-7 text-slate-300" />
      )}
    </button>
  );
}

function PhotoRequiredField({ item, onUpdate }: FieldRendererProps) {
  const hasPhoto = item.photoIds.length > 0 || item.value === 'photo_captured';

  const handleCapture = () => {
    // Placeholder: in production this would open the camera / file picker
    onUpdate({
      completed: true,
      value: 'photo_captured',
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={hasPhoto ? 'outline' : 'default'}
        size="lg"
        onClick={handleCapture}
        className={cn(
          'h-12 gap-2',
          hasPhoto && 'border-emerald-500 text-emerald-600',
        )}
      >
        <Camera className="w-5 h-5" />
        {hasPhoto ? 'Photo captured' : 'Tap to capture photo'}
      </Button>
      {!hasPhoto && (
        <span className="text-xs text-slate-500">Photo required</span>
      )}
    </div>
  );
}

function YesNoField({ item, onUpdate }: FieldRendererProps) {
  const select = (answer: 'yes' | 'no') => {
    onUpdate({ completed: true, value: answer });
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => select('yes')}
        className={cn(
          'flex-1 h-12 rounded-lg font-semibold text-sm transition-colors border',
          item.value === 'yes'
            ? 'bg-emerald-500 text-white border-emerald-500'
            : 'bg-white text-emerald-600 border-emerald-300 hover:bg-emerald-50 active:bg-emerald-100',
        )}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => select('no')}
        className={cn(
          'flex-1 h-12 rounded-lg font-semibold text-sm transition-colors border',
          item.value === 'no'
            ? 'bg-red-500 text-white border-red-500'
            : 'bg-white text-red-600 border-red-300 hover:bg-red-50 active:bg-red-100',
        )}
      >
        No
      </button>
    </div>
  );
}

function RatingField({ item, onUpdate }: FieldRendererProps) {
  const current = item.value ? parseInt(item.value, 10) : 0;

  const setRating = (rating: number) => {
    onUpdate({ completed: true, value: String(rating) });
  };

  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setRating(n)}
          className="w-11 h-11 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-100 active:bg-slate-200"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          role="radio"
          aria-checked={current >= n}
        >
          <Star
            className={cn(
              'w-7 h-7 transition-colors',
              current >= n
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-300',
            )}
          />
        </button>
      ))}
    </div>
  );
}

function MultipleChoiceField({ item, onUpdate }: FieldRendererProps) {
  const options = item.options ?? [];

  const select = (option: string) => {
    onUpdate({ completed: true, value: option });
  };

  return (
    <div className="flex flex-col gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => select(option)}
          className={cn(
            'w-full min-h-[44px] px-4 py-2.5 rounded-lg text-sm text-left transition-all border',
            item.value === option
              ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/30'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100',
          )}
        >
          <span className="flex items-center gap-3">
            <span
              className={cn(
                'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors',
                item.value === option
                  ? 'border-blue-500 bg-blue-500'
                  : 'border-slate-300',
              )}
            >
              {item.value === option && (
                <span className="block w-full h-full rounded-full bg-white scale-[0.4]" />
              )}
            </span>
            {option}
          </span>
        </button>
      ))}
    </div>
  );
}

function TextField({ item, onUpdate }: FieldRendererProps) {
  const [local, setLocal] = useState(item.value ?? '');

  const handleBlur = () => {
    const trimmed = local.trim();
    onUpdate({
      value: trimmed,
      completed: trimmed.length > 0,
    });
  };

  return (
    <textarea
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      placeholder="Enter text..."
      rows={3}
      className="w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-y"
    />
  );
}

function SignatureField({ item, onUpdate }: FieldRendererProps) {
  const handleSign = () => {
    // Placeholder: in production this would open a signature pad
    onUpdate({ completed: true, value: 'signed' });
  };

  return (
    <Button
      variant={item.completed ? 'outline' : 'default'}
      size="lg"
      onClick={handleSign}
      className={cn(
        'h-12 gap-2',
        item.completed && 'border-emerald-500 text-emerald-600',
      )}
    >
      <PenLine className="w-5 h-5" />
      {item.completed ? 'Signed' : 'Tap to sign'}
    </Button>
  );
}

function DateField({ item, onUpdate }: FieldRendererProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onUpdate({
      value: v,
      completed: v.length > 0,
    });
  };

  return (
    <Input
      type="date"
      value={item.value ?? ''}
      onChange={handleChange}
      className="h-12 max-w-xs"
    />
  );
}

function NumberField({ item, onUpdate }: FieldRendererProps) {
  const [local, setLocal] = useState(item.value ?? '');

  const handleBlur = () => {
    const trimmed = local.trim();
    onUpdate({
      value: trimmed,
      completed: trimmed.length > 0,
    });
  };

  return (
    <Input
      type="number"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      placeholder="Enter number..."
      className="h-12 max-w-xs"
    />
  );
}

// ---------------------------------------------------------------------------
// Field type → renderer map
// ---------------------------------------------------------------------------

const FIELD_RENDERERS: Record<
  ChecklistFieldType,
  React.ComponentType<FieldRendererProps>
> = {
  checkbox: CheckboxField,
  photo_required: PhotoRequiredField,
  yes_no: YesNoField,
  rating: RatingField,
  multiple_choice: MultipleChoiceField,
  text: TextField,
  signature: SignatureField,
  date: DateField,
  number: NumberField,
};

// ---------------------------------------------------------------------------
// Single checklist item row
// ---------------------------------------------------------------------------

interface ItemRowProps {
  item: ChecklistItem;
  onUpdateItem: (itemId: string, updates: Partial<ChecklistItem>) => void;
}

function ItemRow({ item, onUpdateItem }: ItemRowProps) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [localNotes, setLocalNotes] = useState(item.notes ?? '');

  const handleUpdate = useCallback(
    (updates: Partial<ChecklistItem>) => {
      onUpdateItem(item.id, updates);
    },
    [item.id, onUpdateItem],
  );

  const handleNotesBlur = () => {
    onUpdateItem(item.id, { notes: localNotes.trim() });
  };

  const FieldRenderer = FIELD_RENDERERS[item.fieldType];

  return (
    <Card
      className={cn(
        'transition-all border-l-4',
        item.completed
          ? 'border-l-emerald-500 bg-emerald-50/30'
          : 'border-l-slate-200',
      )}
    >
      <CardContent className="p-4">
        {/* Row header: status indicator + label */}
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 mt-0.5">
            {item.completed ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : (
              <Circle className="w-5 h-5 text-slate-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm font-medium leading-snug',
                item.completed ? 'text-slate-600' : 'text-slate-900',
              )}
            >
              {item.label}
              {item.required && (
                <span className="text-red-500 ml-1" aria-label="required">
                  *
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Field control */}
        <div className="pl-8">
          {FieldRenderer && (
            <FieldRenderer item={item} onUpdate={handleUpdate} />
          )}
        </div>

        {/* Notes toggle + area */}
        <div className="pl-8 mt-3">
          <button
            type="button"
            onClick={() => setNotesOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors min-h-[36px]"
            aria-expanded={notesOpen}
          >
            <MessageSquare className="w-4 h-4" />
            {notesOpen ? 'Hide notes' : 'Add notes'}
          </button>

          {notesOpen && (
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Add a note..."
              rows={2}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-y"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section
// ---------------------------------------------------------------------------

interface SectionPanelProps {
  section: Section;
  onUpdateItem: (itemId: string, updates: Partial<ChecklistItem>) => void;
}

function SectionPanel({ section, onUpdateItem }: SectionPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const completedCount = section.items.filter((i) => i.completed).length;
  const totalCount = section.items.length;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-1 py-2 min-h-[44px] group"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-800">
            {section.name}
          </h2>
          <span className="text-xs text-slate-400 font-normal">
            {completedCount}/{totalCount}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3">
          {section.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onUpdateItem={onUpdateItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChecklistRunner({
  checklist,
  items,
  onUpdateItem,
  onComplete,
  onBack,
  projectName,
  isCompleting = false,
}: ChecklistRunnerProps) {
  // ---- Progress ----
  const { completedCount, totalCount, percentage } = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completedCount: completed, totalCount: total, percentage: pct };
  }, [items]);

  // ---- Can complete? All required items must be done ----
  const canComplete = useMemo(() => {
    return items
      .filter((i) => i.required)
      .every((i) => i.completed);
  }, [items]);

  // ---- Sections ----
  const sections = useMemo(() => groupBySection(items), [items]);

  // ---- Progress bar color ----
  const progressColor =
    percentage === 100 ? 'bg-emerald-500' : 'bg-blue-500';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* ================================================================ */}
      {/* HEADER                                                          */}
      {/* ================================================================ */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="px-4 pt-3 pb-2">
          {/* Top row: back + title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors -ml-1"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-slate-900 truncate">
                {checklist.name}
              </h1>
              {projectName && (
                <p className="text-xs text-slate-500 truncate">{projectName}</p>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-600">
                {completedCount} of {totalCount} completed ({percentage}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500 ease-out',
                  progressColor,
                )}
                style={{ width: `${percentage}%` }}
                role="progressbar"
                aria-valuenow={percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Checklist progress: ${percentage}%`}
              />
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* BODY                                                            */}
      {/* ================================================================ */}
      <main className="flex-1 px-4 py-5 pb-28 space-y-6">
        {sections.map((section) => (
          <SectionPanel
            key={section.name}
            section={section}
            onUpdateItem={onUpdateItem}
          />
        ))}

        {items.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm">No items in this checklist.</p>
          </div>
        )}
      </main>

      {/* ================================================================ */}
      {/* FOOTER                                                          */}
      {/* ================================================================ */}
      <footer className="sticky bottom-0 z-30 bg-white border-t border-slate-200 p-4 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <Button
          variant="default"
          size="lg"
          onClick={onComplete}
          isLoading={isCompleting}
          disabled={!canComplete || isCompleting}
          className="w-full h-12 text-base font-semibold"
        >
          {isCompleting
            ? 'Completing...'
            : canComplete
              ? 'Complete Checklist'
              : `Complete Checklist (${items.filter((i) => i.required && !i.completed).length} required remaining)`}
        </Button>
      </footer>
    </div>
  );
}
