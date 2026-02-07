import { useState } from 'react';
import {
  Plus,
  FileText,
  TrendingUp,
  Calendar,
  FileStack,
  Trash2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import type { Page, PageType } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PagesListProps {
  pages: Page[];
  isLoading?: boolean;
  onCreatePage: (pageType: PageType) => void;
  onSelectPage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface PageTypeOption {
  type: PageType;
  label: string;
  icon: React.ReactNode;
  color: string;
  iconBg: string;
  ai?: boolean;
}

const PAGE_TYPE_OPTIONS: PageTypeOption[] = [
  {
    type: 'general',
    label: 'General Note',
    icon: <FileText className="h-5 w-5" />,
    color: 'text-slate-600',
    iconBg: 'bg-slate-100',
  },
  {
    type: 'walkthrough_note',
    label: 'Walkthrough Note',
    icon: <FileText className="h-5 w-5" />,
    color: 'text-blue-600',
    iconBg: 'bg-blue-100',
    ai: true,
  },
  {
    type: 'progress_recap',
    label: 'Progress Recap',
    icon: <TrendingUp className="h-5 w-5" />,
    color: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    ai: true,
  },
  {
    type: 'daily_log',
    label: 'Daily Log',
    icon: <Calendar className="h-5 w-5" />,
    color: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
  {
    type: 'proposal',
    label: 'Proposal',
    icon: <FileText className="h-5 w-5" />,
    color: 'text-cyan-600',
    iconBg: 'bg-cyan-100',
  },
];

const PAGE_TYPE_CONFIG: Record<
  PageType,
  { label: string; icon: React.ReactNode; color: string; iconBg: string; badgeBg: string; badgeText: string }
> = {
  general: {
    label: 'General',
    icon: <FileText className="h-4 w-4" />,
    color: 'text-slate-600',
    iconBg: 'bg-slate-100',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
  },
  walkthrough_note: {
    label: 'Walkthrough',
    icon: <FileText className="h-4 w-4" />,
    color: 'text-blue-600',
    iconBg: 'bg-blue-100',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
  },
  progress_recap: {
    label: 'Progress',
    icon: <TrendingUp className="h-4 w-4" />,
    color: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
  },
  daily_log: {
    label: 'Daily Log',
    icon: <Calendar className="h-4 w-4" />,
    color: 'text-amber-600',
    iconBg: 'bg-amber-100',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
  },
  ai_summary: {
    label: 'AI Summary',
    icon: <Sparkles className="h-4 w-4" />,
    color: 'text-purple-600',
    iconBg: 'bg-purple-100',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
  },
  proposal: {
    label: 'Proposal',
    icon: <FileText className="h-4 w-4" />,
    color: 'text-cyan-600',
    iconBg: 'bg-cyan-100',
    badgeBg: 'bg-cyan-100',
    badgeText: 'text-cyan-700',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PagesList({
  pages,
  isLoading = false,
  onCreatePage,
  onSelectPage,
  onDeletePage,
}: PagesListProps) {
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const handleCreate = (pageType: PageType) => {
    onCreatePage(pageType);
    setShowTypeSelector(false);
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">Loading pages...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Pages</h2>
        <Button
          size="sm"
          onClick={() => setShowTypeSelector((prev) => !prev)}
        >
          <Plus className="h-4 w-4" />
          New Page
        </Button>
      </div>

      {/* ── Page type selector ───────────────────────────────────────── */}
      {showTypeSelector && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-medium text-slate-700">
              Choose a page type
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAGE_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => handleCreate(option.type)}
                  className={cn(
                    'group relative flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-center transition-all hover:border-slate-300 hover:shadow-sm active:bg-slate-50'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg',
                      option.iconBg,
                      option.color
                    )}
                  >
                    {option.icon}
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    {option.label}
                  </span>

                  {option.ai && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                      <Sparkles className="h-2.5 w-2.5" />
                      AI
                    </span>
                  )}

                  {option.ai && (
                    <span className="text-[11px] leading-tight text-slate-400">
                      AI generation coming soon
                    </span>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pages list ───────────────────────────────────────────────── */}
      {pages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-1.5">
          {pages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              onSelect={() => onSelectPage(page.id)}
              onDelete={() => onDeletePage(page.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16">
      <FileStack className="h-12 w-12 text-slate-300" />
      <p className="mt-4 text-base font-medium text-slate-600">
        No pages yet
      </p>
      <p className="mt-1 text-sm text-slate-400">
        Create your first page to get started
      </p>
    </div>
  );
}

interface PageRowProps {
  page: Page;
  onSelect: () => void;
  onDelete: () => void;
}

function PageRow({ page, onSelect, onDelete }: PageRowProps) {
  const config = PAGE_TYPE_CONFIG[page.pageType];

  const formattedDate = page.updatedAt?.toDate
    ? formatRelativeTime(page.updatedAt.toDate())
    : '';

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition-all hover:border-slate-300 hover:shadow-sm active:bg-slate-50"
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          config.iconBg,
          config.color
        )}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {page.title || 'Untitled'}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span
            className={cn(
              'inline-block rounded-full px-2 py-0.5 text-[11px] font-medium',
              config.badgeBg,
              config.badgeText
            )}
          >
            {config.label}
          </span>
          {formattedDate && (
            <span className="text-xs text-slate-400">{formattedDate}</span>
          )}
        </div>
      </div>

      {/* Delete */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Delete ${page.title || 'Untitled'}`}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            e.preventDefault();
            onDelete();
          }
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </div>
    </button>
  );
}
