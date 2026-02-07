import { useState, useRef, useEffect } from 'react';
import { Search, Plus, Camera, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { ProjectCard } from './ProjectCard';
import { cn } from '@/lib/utils';

interface ProjectListProps {
  onCreateClick: () => void;
}

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'updated', label: 'Recently Updated' },
  { value: 'alpha', label: 'A-Z' },
] as const;

const filterTabs = [
  { value: 'all', label: 'All' },
  { value: 'starred', label: 'Starred' },
  { value: 'my-projects', label: 'My Projects' },
  { value: 'archived', label: 'Archived' },
] as const;

export function ProjectList({ onCreateClick }: ProjectListProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'updated' | 'alpha'>('newest');
  const [activeFilter, setActiveFilter] = useState<'all' | 'starred' | 'my-projects' | 'archived'>('all');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  const { data: projects, isLoading, error, refetch } = useProjects({
    search: search || undefined,
    sort,
  });

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

  return (
    <div className="flex flex-col flex-1">
      {/* Search Bar + Create Button Row (CompanyCam style) */}
      <div className="flex items-center gap-3 mb-3">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Find a project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
          />
        </div>
        {/* Create Button (CompanyCam style - blue pill, right-aligned) */}
        <button
          onClick={onCreateClick}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-full transition-colors ml-auto"
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      </div>

      {/* Filter Tabs + Sort + Refresh (CompanyCam row) */}
      <div className="flex items-center gap-2 mb-4">
        {/* Tabs */}
        <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg bg-white p-0.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={cn(
                'px-3.5 py-1.5 text-sm rounded-md transition-colors',
                activeFilter === tab.value
                  ? 'font-medium text-slate-900 bg-slate-100'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort/Filter Button */}
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
      </div>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto bg-white rounded-lg border border-slate-200">
        {isLoading ? (
          /* Loading Skeletons - flat row style */
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
              <ProjectCard key={project.id} project={project} />
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
