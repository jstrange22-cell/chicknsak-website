import { Link } from 'react-router-dom';
import { formatRelativeTime } from '@/lib/utils';
import type { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
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

  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex items-center px-4 py-4 hover:bg-slate-50 transition-colors"
    >
      {/* Left: Project info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-slate-900 truncate">
          {project.name}
        </h3>
        {address && (
          <p className="text-sm text-slate-500 mt-0.5 truncate">{address}</p>
        )}
        <p className="text-xs text-slate-400 mt-0.5">
          Last updated {updatedLabel}
        </p>
      </div>

      {/* Middle: Photos count */}
      <div className="flex-shrink-0 text-center mx-4 w-16">
        <span className="text-xs text-slate-400">Photos</span>
        <p className="text-lg font-semibold text-slate-900">{photoCount}</p>
      </div>

      {/* Middle: Recent User */}
      <div className="flex-shrink-0 text-center mx-4 w-24">
        <span className="text-xs text-slate-400">Recent User</span>
        <div className="flex justify-center mt-1">
          <div className="w-7 h-7 rounded-full bg-slate-700 text-white text-xs flex items-center justify-center font-medium">
            {initials}
          </div>
        </div>
      </div>

      {/* Right: empty photo placeholder text */}
      <div className="flex-shrink-0 w-56 text-right">
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
    </Link>
  );
}
