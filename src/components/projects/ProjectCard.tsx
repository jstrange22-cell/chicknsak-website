import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Project, ProjectStatus } from '@/types';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; classes: string }> = {
  lead: { label: 'Lead', classes: 'bg-purple-100 text-purple-700' },
  active: { label: 'Active', classes: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', classes: 'bg-emerald-100 text-emerald-700' },
  on_hold: { label: 'On Hold', classes: 'bg-amber-100 text-amber-700' },
  archived: { label: 'Archived', classes: 'bg-slate-100 text-slate-500' },
};

interface ProjectCardProps {
  project: Project;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function ProjectCard({ project, selectable, selected, onToggleSelect }: ProjectCardProps) {
  const photoCount = 0; // TODO: Get actual count from photos subcollection

  // Build address string: "street • city, state zip"
  const addressParts: string[] = [];
  if (project.addressStreet) addressParts.push(project.addressStreet);
  const cityStateZip = [
    project.addressCity,
    project.addressState ? `${project.addressState}${project.addressZip ? ' ' + project.addressZip : ''}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  if (cityStateZip) addressParts.push(cityStateZip);
  const address = addressParts.length > 1
    ? addressParts.join(' \u2022 ')
    : addressParts[0] || project.addressFull || '';

  // Format the date as "Dec 11, 2025, 11:05 AM" style
  let updatedLabel = 'Unknown';
  try {
    const date = project.updatedAt?.toDate?.() || project.createdAt?.toDate?.() || new Date();
    updatedLabel = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ', ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    updatedLabel = formatRelativeTime(
      project.updatedAt?.toDate?.() || project.createdAt?.toDate?.() || new Date()
    );
  }

  // Derive initials from createdBy (fallback to "?")
  const initials = project.createdBy
    ? project.createdBy
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const statusInfo = STATUS_CONFIG[project.status] || STATUS_CONFIG.lead;

  return (
    <div className="flex items-center px-3 py-3 md:px-4 md:py-4 hover:bg-slate-50 active:bg-slate-100 transition-colors touch-manipulation">
      {/* Checkbox */}
      {selectable && (
        <div className="flex-shrink-0 mr-2 md:mr-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.(project.id)}
            className="h-5 w-5 md:h-4 md:w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Left: Project info (clickable link) */}
      <Link
        to={`/projects/${project.id}`}
        className="flex-1 min-w-0"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm md:text-base font-semibold text-slate-900 truncate">
            {project.name}
          </h3>
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0', statusInfo.classes)}>
            {statusInfo.label}
          </span>
        </div>
        {address && (
          <p className="text-xs md:text-sm text-slate-500 mt-0.5 truncate">{address}</p>
        )}
        <p className="text-[11px] md:text-xs text-slate-400 mt-0.5">
          Updated {updatedLabel}
        </p>
      </Link>

      {/* Middle: Photos count -- hidden on mobile */}
      <div className="hidden md:block flex-shrink-0 text-center mx-4 w-16">
        <span className="text-xs text-slate-400">Photos</span>
        <p className="text-lg font-semibold text-slate-900">{photoCount}</p>
      </div>

      {/* Middle: Recent User -- hidden on mobile */}
      <div className="hidden md:block flex-shrink-0 text-center mx-4 w-24">
        <span className="text-xs text-slate-400">Recent User</span>
        <div className="flex justify-center mt-1">
          <div className="w-7 h-7 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center font-medium">
            {initials}
          </div>
        </div>
      </div>

      {/* Right: empty photo placeholder text -- hidden on mobile */}
      <div className="hidden lg:block flex-shrink-0 w-56 text-right">
        {photoCount > 0 ? (
          <div className="flex -space-x-2 justify-end">
            {/* TODO: Render actual photo thumbnails */}
          </div>
        ) : (
          <span className="text-sm text-slate-400 italic leading-snug">
            No photos have been added to this project yet.
          </span>
        )}
      </div>

      {/* Mobile: chevron indicator */}
      <div className="md:hidden flex-shrink-0 ml-2">
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </div>
    </div>
  );
}
