'use client';

import { useState, useCallback, useId } from 'react';
import {
  Plus,
  Trash2,
  X,
  Image,
  Grid,
  Columns,
  AlignJustify,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { generateReportFromPhotos } from '@/lib/ai/reportGenerator';
import type { ReportType, ReportLayout, ReportSection } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
  description?: string;
}

interface ReportBuilderProps {
  initialName?: string;
  initialCoverTitle?: string;
  initialReportType?: ReportType;
  initialIncludeLogo?: boolean;
  initialSections?: ReportSection[];
  projectPhotos: ProjectPhoto[];
  onSave: (data: {
    name: string;
    coverTitle: string;
    reportType: ReportType;
    includeLogo: boolean;
    sections: ReportSection[];
  }) => void;
  onPublish?: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'photo', label: 'Photo Report' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'progress', label: 'Progress' },
  { value: 'custom', label: 'Custom' },
];

const LAYOUT_OPTIONS: { value: ReportLayout; label: string; icon: typeof Grid }[] = [
  { value: 'single', label: 'Single Column', icon: AlignJustify },
  { value: 'grid', label: '2-Column Grid', icon: Grid },
  { value: 'side-by-side', label: 'Side by Side', icon: Columns },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createEmptySection(): ReportSection {
  return {
    id: crypto.randomUUID(),
    title: '',
    photoIds: [],
    notes: '',
    layout: 'grid',
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PhotoPickerProps {
  projectPhotos: ProjectPhoto[];
  selectedIds: string[];
  onToggle: (photoId: string) => void;
  onClose: () => void;
}

function PhotoPicker({ projectPhotos, selectedIds, onToggle, onClose }: PhotoPickerProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-700">Select Photos</span>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {projectPhotos.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">No project photos available.</p>
      ) : (
        <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5 md:grid-cols-6">
          {projectPhotos.map((photo) => {
            const isSelected = selectedIds.includes(photo.id);
            return (
              <button
                key={photo.id}
                type="button"
                onClick={() => onToggle(photo.id)}
                className={cn(
                  'group relative aspect-square overflow-hidden rounded-md border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-600/30'
                    : 'border-transparent hover:border-zinc-300',
                )}
              >
                <img
                  src={photo.thumbnailUrl ?? photo.url}
                  alt={photo.description ?? 'Project photo'}
                  className="h-full w-full object-cover"
                />
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-600/30">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Card
// ---------------------------------------------------------------------------

interface SectionCardProps {
  section: ReportSection;
  index: number;
  canRemove: boolean;
  projectPhotos: ProjectPhoto[];
  onUpdate: (id: string, patch: Partial<ReportSection>) => void;
  onRemove: (id: string) => void;
}

function SectionCard({
  section,
  index,
  canRemove,
  projectPhotos,
  onUpdate,
  onRemove,
}: SectionCardProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleTogglePhoto = useCallback(
    (photoId: string) => {
      const current = section.photoIds;
      const next = current.includes(photoId)
        ? current.filter((id) => id !== photoId)
        : [...current, photoId];
      onUpdate(section.id, { photoIds: next });
    },
    [section.id, section.photoIds, onUpdate],
  );

  const handleRemovePhoto = useCallback(
    (photoId: string) => {
      onUpdate(section.id, { photoIds: section.photoIds.filter((id) => id !== photoId) });
    },
    [section.id, section.photoIds, onUpdate],
  );

  const photosById = new Map(projectPhotos.map((p) => [p.id, p]));

  return (
    <Card className="border border-zinc-200 bg-white shadow-sm">
      <CardContent className="space-y-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Section {index + 1}
            </label>
            <Input
              placeholder="Section title"
              value={section.title}
              onChange={(e) => onUpdate(section.id, { title: e.target.value })}
            />
          </div>
          {canRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="mt-5 shrink-0 text-zinc-400 hover:text-red-600"
              onClick={() => onRemove(section.id)}
              aria-label="Remove section"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Layout selector */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Layout</label>
          <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
            {LAYOUT_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onUpdate(section.id, { layout: value })}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  section.layout === value
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700',
                )}
                aria-label={label}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected photos */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Photos</label>
          {section.photoIds.length > 0 ? (
            <div className="mb-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {section.photoIds.map((photoId) => {
                const photo = photosById.get(photoId);
                if (!photo) return null;
                return (
                  <div key={photoId} className="group relative aspect-square overflow-hidden rounded-md border border-zinc-200">
                    <img
                      src={photo.thumbnailUrl ?? photo.url}
                      alt={photo.description ?? 'Selected photo'}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photoId)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                      aria-label="Remove photo"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mb-2 flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Image className="h-4 w-4" />
                No photos selected
              </div>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPickerOpen((prev) => !prev)}
          >
            <Image className="mr-1.5 h-3.5 w-3.5" />
            {isPickerOpen ? 'Close Picker' : 'Add Photos'}
          </Button>

          {isPickerOpen && (
            <div className="mt-2">
              <PhotoPicker
                projectPhotos={projectPhotos}
                selectedIds={section.photoIds}
                onToggle={handleTogglePhoto}
                onClose={() => setIsPickerOpen(false)}
              />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-zinc-500">Notes</label>
          <Textarea
            placeholder="Add notes for this section..."
            value={section.notes}
            onChange={(e) => onUpdate(section.id, { notes: e.target.value })}
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ReportBuilder
// ---------------------------------------------------------------------------

export default function ReportBuilder({
  initialName = '',
  initialCoverTitle = '',
  initialReportType = 'photo',
  initialIncludeLogo = true,
  initialSections,
  projectPhotos,
  onSave,
  onPublish,
  onCancel,
  isSaving = false,
}: ReportBuilderProps) {
  const formId = useId();

  // Cover settings
  const [name, setName] = useState(initialName);
  const [coverTitle, setCoverTitle] = useState(initialCoverTitle);
  const [reportType, setReportType] = useState<ReportType>(initialReportType);
  const [includeLogo, setIncludeLogo] = useState(initialIncludeLogo);

  // Sections
  const [sections, setSections] = useState<ReportSection[]>(
    () => initialSections ?? [createEmptySection()],
  );

  // AI generation
  const [isAIGenerating, setIsAIGenerating] = useState(false);

  // Validation
  const [nameError, setNameError] = useState<string | undefined>();

  // ---- Section handlers ----------------------------------------------------

  const handleUpdateSection = useCallback((id: string, patch: Partial<ReportSection>) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }, []);

  const handleRemoveSection = useCallback((id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleAddSection = useCallback(() => {
    setSections((prev) => [...prev, createEmptySection()]);
  }, []);

  // ---- AI Generation -------------------------------------------------------

  const handleAIGenerate = useCallback(async () => {
    if (projectPhotos.length === 0) return;

    setIsAIGenerating(true);
    try {
      const photos = projectPhotos.map((p) => ({
        url: p.url,
        caption: p.description ?? '',
        tags: [] as string[],
        timestamp: undefined as string | undefined,
      }));

      const result = await generateReportFromPhotos(photos, name || 'Untitled Report', reportType);

      const aiSections: ReportSection[] = result.sections.map((s) => ({
        id: crypto.randomUUID(),
        title: s.title,
        photoIds: (s.photoIndices ?? [])
          .map((idx: number) => projectPhotos[idx]?.id)
          .filter(Boolean) as string[],
        notes: s.notes ?? '',
        layout: 'grid' as ReportLayout,
      }));

      setSections(aiSections.length > 0 ? aiSections : [createEmptySection()]);
    } catch (error) {
      console.error('AI report generation failed:', error);
    } finally {
      setIsAIGenerating(false);
    }
  }, [projectPhotos, name, reportType]);

  // ---- Save / Publish ------------------------------------------------------

  const buildPayload = useCallback(() => {
    if (!name.trim()) {
      setNameError('Report name is required');
      return null;
    }
    setNameError(undefined);
    return { name: name.trim(), coverTitle: coverTitle.trim(), reportType, includeLogo, sections };
  }, [name, coverTitle, reportType, includeLogo, sections]);

  const handleSave = useCallback(() => {
    const payload = buildPayload();
    if (payload) onSave(payload);
  }, [buildPayload, onSave]);

  const handlePublish = useCallback(() => {
    const payload = buildPayload();
    if (payload) {
      onSave(payload);
      onPublish?.();
    }
  }, [buildPayload, onSave, onPublish]);

  // ---- Render --------------------------------------------------------------

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24">
      {/* ------------------------------------------------------------------ */}
      {/* Cover Settings                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card className="border border-zinc-200 bg-white shadow-sm">
        <CardContent className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-zinc-900">Cover Settings</h2>

          {/* Report Name */}
          <div>
            <label htmlFor={`${formId}-name`} className="mb-1 block text-sm font-medium text-zinc-700">
              Report Name <span className="text-red-500">*</span>
            </label>
            <Input
              id={`${formId}-name`}
              placeholder="Enter report name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (e.target.value.trim()) setNameError(undefined);
              }}
              error={nameError}
            />
          </div>

          {/* Cover Title */}
          <div>
            <label htmlFor={`${formId}-cover`} className="mb-1 block text-sm font-medium text-zinc-700">
              Cover Title
            </label>
            <Input
              id={`${formId}-cover`}
              placeholder="Report cover title"
              value={coverTitle}
              onChange={(e) => setCoverTitle(e.target.value)}
            />
          </div>

          {/* Report Type */}
          <div>
            <label htmlFor={`${formId}-type`} className="mb-1 block text-sm font-medium text-zinc-700">
              Report Type
            </label>
            <select
              id={`${formId}-type`}
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {REPORT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Include Logo */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeLogo}
              onChange={(e) => setIncludeLogo(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-zinc-700">Include Company Logo</span>
          </label>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Sections                                                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Sections</h2>
          <Button
            type="button"
            variant="outline"
            onClick={handleAIGenerate}
            disabled={isAIGenerating || projectPhotos.length === 0}
            className="gap-2"
          >
            {isAIGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing {projectPhotos.length} photos...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                AI Generate
              </>
            )}
          </Button>
        </div>

        {sections.map((section, idx) => (
          <SectionCard
            key={section.id}
            section={section}
            index={idx}
            canRemove={sections.length > 1}
            projectPhotos={projectPhotos}
            onUpdate={handleUpdateSection}
            onRemove={handleRemoveSection}
          />
        ))}

        <Button variant="outline" onClick={handleAddSection} className="w-full">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Section
        </Button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-3xl items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSave} disabled={isSaving} isLoading={isSaving}>
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
          {onPublish && (
            <Button variant="default" onClick={handlePublish} disabled={isSaving}>
              Publish
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
