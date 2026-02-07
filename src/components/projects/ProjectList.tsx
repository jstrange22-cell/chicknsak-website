import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Camera, SlidersHorizontal, RefreshCw, CheckSquare, Square, X } from 'lucide-react';
import { useProjects, useUpdateProject } from '@/hooks/useProjects';
import { ProjectCard } from './ProjectCard';
import { cn } from '@/lib/utils';
import type { ProjectStatus } from '@/types';

interface ProjectListProps {
  onCreateClick: () => void;
}

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'updated', label: 'Recently Updated' },
  { value: 'alpha', label: 'A-Z' },
] as const;

const statusFilters: Array<{ value: string; label: string; classes: string }> = [
  { value: '', label: 'All', classes: 'bg-slate-100 text-slate-700' },
  { value: 'lead', label: 'Lead', classes: 'bg-purple-100 text-purple-700' },
  { value: 'active', label: 'Active', classes: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Completed', classes: 'bg-emerald-100 text-emerald-700' },
  { value: 'on_hold', label: 'On Hold', classes: 'bg-amber-100 text-amber-700' },
  { value: 'archived', label: 'Archived', classes: 'bg-slate-100 text-slate-500' },
];

export function ProjectList({ onCreateClick }: ProjectListProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'updated' | 'alpha'>('newest');
  const [statusFilter, setStatusFilter] = useState('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ProjectStatus | ''>('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const updateProject = useUpdateProject();

  const { data: projects, isLoading, error, refetch } = useProjects({
    search: search || undefined,
    sort,
    status: statusFilter || undefined,
  });

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, search, sort]);

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    }
    if (showSortMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSortMenu]);

  const selectable = true; // Always show checkboxes
  const allSelected = projects && projects.length > 0 && selectedIds.size === projects.length;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!projects) return;
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map((p) => p.id)));
    }
  }

  async function handleBulkStatusChange() {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const promises = Array.from(selectedIds).map((id) =>
        updateProject.mutateAsync({ id, data: { status: bulkStatus } })
      );
      await Promise.all(promises);
      setSelectedIds(new Set());
      setBulkStatus('');
    } catch (err) {
      console.error('Bulk update failed:', err);
    } finally {
      setBulkUpdating(false);
    }
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Search Bar + Create Button Row */}
      <div className="flex items-center gap-2 md:gap-3 mb-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Find a project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 md:h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 touch-manipulation"
          />
        </div>
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1.5 px-4 md:px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-full transition-colors ml-auto touch-manipulation whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Status Filter Pills */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {statusFilters.map((sf) => (
          <button
            key={sf.value}
            onClick={() => setStatusFilter(sf.value)}
            className={cn(
              'px-3 py-1.5 md:py-1 text-xs font-medium rounded-full transition-colors border whitespace-nowrap touch-manipulation flex-shrink-0',
              statusFilter === sf.value
                ? `${sf.classes} border-current ring-1 ring-current/20`
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            )}
          >
            {sf.label}
          </button>
        ))}
      </div>

      {/* Sort + Refresh Row */}
      <div className="flex items-center gap-2 mb-4">
        {/* Sort Button */}
        <div className="relative" ref={sortMenuRef}>
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
            aria-label="Sort and filter"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          {showSortMenu && (
            <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSort(option.value);
                    setShowSortMenu(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm transition-colors',
                    sort === option.value
                      ? 'text-blue-600 bg-blue-50 font-medium'
                      : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => refetch()}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>

        {/* Selection info */}
        {selectedIds.size > 0 && (
          <span className="text-xs text-slate-500 ml-2">
            {selectedIds.size} selected
          </span>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-3 px-3 md:px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} selected
          </span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as ProjectStatus | '')}
            className="h-9 md:h-8 px-2 text-sm border border-blue-300 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 touch-manipulation"
          >
            <option value="">Change status...</option>
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={handleBulkStatusChange}
            disabled={!bulkStatus || bulkUpdating}
            className="px-3 py-2 md:py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors touch-manipulation"
          >
            {bulkUpdating ? 'Updating...' : 'Apply'}
          </button>
          <button
            onClick={() => {
              setSelectedIds(new Set());
              setBulkStatus('');
            }}
            className="ml-auto p-2 md:p-1 text-blue-500 hover:text-blue-700 transition-colors touch-manipulation"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Project List */}
      <div className="flex-1 overflow-y-auto bg-white rounded-lg border border-slate-200">
        {/* Select All Header */}
        {projects && projects.length > 0 && (
          <div className="flex items-center px-4 py-2 border-b border-slate-100 bg-slate-50/50">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              {allSelected ? (
                <CheckSquare className="h-4 w-4 text-blue-500" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            <span className="ml-auto text-xs text-slate-400">
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {isLoading ? (
          /* Loading Skeletons */
          <div className="divide-y divide-slate-100">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-4 animate-pulse">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/5" />
                  <div className="h-3 bg-slate-100 rounded w-2/5" />
                </div>
                <div className="h-3 bg-slate-100 rounded w-14 flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16 px-4">
            <p className="text-red-500 text-sm font-medium">Failed to load projects</p>
            <p className="text-slate-400 text-xs mt-1">Please check your connection and try again</p>
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                selectable={selectable}
                selected={selectedIds.has(project.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="text-center py-20 px-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Camera className="h-7 w-7 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              {search ? 'No projects found' : 'No projects yet'}
            </h3>
            <p className="text-sm text-slate-500 mb-6 max-w-[260px] mx-auto leading-relaxed">
              {search
                ? `No results for "${search}". Try a different search term.`
                : 'Create your first project to start capturing photos and tracking progress.'}
            </p>
            {!search && (
              <button
                onClick={onCreateClick}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Project
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
