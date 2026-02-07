import { useState, useEffect, useMemo } from 'react';
import { X, Image, Plus, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { BeforeAfterSlider } from '@/components/showcase/BeforeAfterSlider';
import { cn } from '@/lib/utils';

interface ProjectPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
}

interface ShowcaseBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description?: string;
    beforePhotoId?: string;
    afterPhotoId?: string;
    galleryPhotoIds: string[];
  }) => void;
  isSubmitting?: boolean;
  projectPhotos: ProjectPhoto[];
  initialData?: {
    title: string;
    description?: string;
    beforePhotoId?: string;
    afterPhotoId?: string;
    galleryPhotoIds: string[];
  };
}

export function ShowcaseBuilder({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  projectPhotos,
  initialData,
}: ShowcaseBuilderProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [beforePhotoId, setBeforePhotoId] = useState<string | undefined>();
  const [afterPhotoId, setAfterPhotoId] = useState<string | undefined>();
  const [galleryPhotoIds, setGalleryPhotoIds] = useState<string[]>([]);
  const [titleError, setTitleError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const isEditing = !!initialData;

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '');
      setDescription(initialData?.description || '');
      setBeforePhotoId(initialData?.beforePhotoId);
      setAfterPhotoId(initialData?.afterPhotoId);
      setGalleryPhotoIds(initialData?.galleryPhotoIds || []);
      setTitleError('');
      setShowPreview(false);
    }
  }, [isOpen, initialData]);

  const beforePhoto = useMemo(
    () => projectPhotos.find((p) => p.id === beforePhotoId),
    [projectPhotos, beforePhotoId]
  );

  const afterPhoto = useMemo(
    () => projectPhotos.find((p) => p.id === afterPhotoId),
    [projectPhotos, afterPhotoId]
  );

  const canPreview = !!beforePhoto && !!afterPhoto;

  const toggleGalleryPhoto = (photoId: string) => {
    setGalleryPhotoIds((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setTitleError('Showcase title is required');
      return;
    }
    setTitleError('');

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      beforePhotoId,
      afterPhotoId,
      galleryPhotoIds,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto">
      <div className="bg-white w-full min-h-screen md:min-h-0 md:max-w-2xl md:my-8 md:rounded-xl md:shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:rounded-t-xl">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Showcase' : 'Create Showcase'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Kitchen Renovation Transformation"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError('');
              }}
              error={titleError}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Description
            </label>
            <Textarea
              placeholder="Describe this before/after transformation..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="border-slate-300 focus:ring-blue-500"
            />
          </div>

          {/* Before Photo Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Before Photo
            </label>
            <p className="text-xs text-slate-500">
              Select the photo showing the original state.
            </p>
            {projectPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed border-slate-200">
                <Image className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No photos available</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {projectPhotos.map((photo) => {
                  const isSelected = beforePhotoId === photo.id;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() =>
                        setBeforePhotoId(isSelected ? undefined : photo.id)
                      }
                      className={cn(
                        'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-500/30'
                          : 'border-transparent hover:border-slate-300'
                      )}
                    >
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            BEFORE
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* After Photo Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              After Photo
            </label>
            <p className="text-xs text-slate-500">
              Select the photo showing the completed result.
            </p>
            {projectPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed border-slate-200">
                <Image className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No photos available</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {projectPhotos.map((photo) => {
                  const isSelected = afterPhotoId === photo.id;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() =>
                        setAfterPhotoId(isSelected ? undefined : photo.id)
                      }
                      className={cn(
                        'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                        isSelected
                          ? 'border-green-500 ring-2 ring-green-500/30'
                          : 'border-transparent hover:border-slate-300'
                      )}
                    >
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                          <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">
                            AFTER
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Preview */}
          {canPreview && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Preview
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview((prev) => !prev)}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {showPreview ? 'Hide' : 'Show'} Preview
                </button>
              </div>
              {showPreview && (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <BeforeAfterSlider
                    beforeUrl={beforePhoto!.url}
                    afterUrl={afterPhoto!.url}
                    className="aspect-video w-full"
                  />
                </div>
              )}
            </div>
          )}

          {/* Gallery Photos Multi-Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Gallery Photos
              </label>
              <span className="text-xs text-slate-500">
                {galleryPhotoIds.length} selected
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Select additional photos to include in the showcase gallery.
            </p>
            {projectPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 rounded-lg border-2 border-dashed border-slate-200">
                <Image className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No photos available</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {projectPhotos.map((photo) => {
                  const isSelected = galleryPhotoIds.includes(photo.id);
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => toggleGalleryPhoto(photo.id)}
                      className={cn(
                        'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-500/30'
                          : 'border-transparent hover:border-slate-300'
                      )}
                    >
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {/* Checkbox overlay */}
                      <div className="absolute top-1 right-1">
                        <div
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                            isSelected
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-white/80 bg-black/30'
                          )}
                        >
                          {isSelected && (
                            <svg
                              className="h-3 w-3 text-white"
                              viewBox="0 0 12 12"
                              fill="none"
                            >
                              <path
                                d="M2 6L5 9L10 3"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
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
              className="flex-1"
              isLoading={isSubmitting}
            >
              <Plus className="h-4 w-4" />
              {isEditing ? 'Update Showcase' : 'Create Showcase'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
