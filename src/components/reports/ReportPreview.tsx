'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { ReportSection, ReportLayout } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhotoData {
  url: string;
  description?: string;
}

interface ReportPreviewProps {
  reportName: string;
  coverTitle?: string;
  sections: ReportSection[];
  photos: Record<string, PhotoData>;
  companyName?: string;
  companyLogo?: string;
  includeLogo?: boolean;
  projectName?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PhotoGridProps {
  photoIds: string[];
  photos: Record<string, PhotoData>;
  layout: ReportLayout;
}

function PhotoGrid({ photoIds, photos, layout }: PhotoGridProps) {
  const resolvedPhotos = useMemo(
    () =>
      photoIds
        .map((id) => ({ id, data: photos[id] }))
        .filter((entry): entry is { id: string; data: PhotoData } => entry.data != null),
    [photoIds, photos],
  );

  if (resolvedPhotos.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded border border-dashed border-zinc-300 bg-zinc-50 text-sm text-zinc-400">
        No photos in this section
      </div>
    );
  }

  const gridClass: Record<ReportLayout, string> = {
    single: 'grid grid-cols-1 gap-4',
    grid: 'grid grid-cols-2 gap-4',
    'side-by-side': 'grid grid-cols-2 gap-4',
  };

  return (
    <div className={gridClass[layout]}>
      {resolvedPhotos.map(({ id, data }) => (
        <figure key={id} className="overflow-hidden rounded-sm border border-zinc-200">
          <img
            src={data.url}
            alt={data.description ?? 'Report photo'}
            className={cn(
              'w-full object-cover',
              layout === 'single' ? 'max-h-[480px]' : 'aspect-[4/3]',
            )}
          />
          {data.description && (
            <figcaption className="border-t border-zinc-100 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-500">
              {data.description}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReportPreview
// ---------------------------------------------------------------------------

export default function ReportPreview({
  reportName,
  coverTitle,
  sections,
  photos,
  companyName,
  companyLogo,
  includeLogo = true,
  projectName,
}: ReportPreviewProps) {
  const today = useMemo(() => formatDate(new Date()), []);

  const nonEmptySections = useMemo(
    () => sections.filter((s) => s.title || s.photoIds.length > 0 || s.notes),
    [sections],
  );

  // Total "pages": cover + 1 per section (simplified model)
  const totalPages = 1 + nonEmptySections.length;

  return (
    <div className="mx-auto max-w-[800px]">
      {/* ================================================================== */}
      {/* Cover Page                                                         */}
      {/* ================================================================== */}
      <section className="relative flex min-h-[560px] flex-col items-center justify-center rounded-t-lg border border-zinc-200 bg-white px-12 py-16 text-center shadow-sm">
        {/* Logo */}
        {includeLogo && companyLogo && (
          <div className="mb-8">
            <img
              src={companyLogo}
              alt={companyName ?? 'Company logo'}
              className="mx-auto h-16 w-auto object-contain"
            />
          </div>
        )}

        {/* Company name (fallback when no logo) */}
        {includeLogo && !companyLogo && companyName && (
          <p className="mb-8 text-sm font-semibold uppercase tracking-widest text-zinc-400">
            {companyName}
          </p>
        )}

        {/* Report title */}
        <h1 className="text-3xl font-bold leading-tight text-zinc-900 sm:text-4xl">
          {reportName || 'Untitled Report'}
        </h1>

        {/* Cover subtitle */}
        {coverTitle && (
          <p className="mt-3 text-lg text-zinc-500">{coverTitle}</p>
        )}

        {/* Meta */}
        <div className="mt-10 space-y-1 text-sm text-zinc-400">
          {projectName && <p>{projectName}</p>}
          <p>{today}</p>
        </div>

        {/* Page indicator */}
        <span className="absolute bottom-4 right-5 text-xs text-zinc-300">
          Page 1 of {totalPages}
        </span>
      </section>

      {/* ================================================================== */}
      {/* Sections                                                           */}
      {/* ================================================================== */}
      {nonEmptySections.map((section, idx) => (
        <section
          key={section.id}
          className="relative border-x border-b border-zinc-200 bg-white px-10 py-10 shadow-sm"
        >
          {/* Divider line at top of each section page */}
          <div className="mb-8 h-px w-full bg-zinc-200" />

          {/* Section title */}
          {section.title && (
            <h2 className="mb-5 text-xl font-bold text-zinc-900">
              {section.title}
            </h2>
          )}

          {/* Photos */}
          <PhotoGrid
            photoIds={section.photoIds}
            photos={photos}
            layout={section.layout}
          />

          {/* Notes */}
          {section.notes && (
            <div className="mt-5 rounded bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-700 whitespace-pre-line">
              {section.notes}
            </div>
          )}

          {/* Page indicator */}
          <span className="absolute bottom-4 right-5 text-xs text-zinc-300">
            Page {idx + 2} of {totalPages}
          </span>
        </section>
      ))}

      {/* ================================================================== */}
      {/* Footer                                                             */}
      {/* ================================================================== */}
      <div className="flex items-center justify-between rounded-b-lg border-x border-b border-zinc-200 bg-zinc-50 px-10 py-4">
        <p className="text-xs text-zinc-400">Report generated by StructureWorks</p>
        <p className="text-xs text-zinc-400">
          {totalPages} {totalPages === 1 ? 'page' : 'pages'}
        </p>
      </div>
    </div>
  );
}
