import { useState, useCallback, useEffect, useMemo } from 'react';
import { X, Image, Check, Plus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';

interface ProjectPhoto {
  id: string;
  url: string;
  thumbnailUrl?: string;
}

interface GalleryBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string; photoIds: string[] }) => void;
  isSubmitting?: boolean;
  projectPhotos: ProjectPhoto[];
}

export function GalleryBuilder({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  projectPhotos,
}: GalleryBuilderProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [nameError, setNameError] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setSelectedIds([]);
      setNameError('');
      setDraggedId(null);
    }
  }, [isOpen]);

  const selectedPhotos = useMemo(
    () =>
      selectedIds
        .map((id) => projectPhotos.find((p) => p.id === id))
        .filter(Boolean) as ProjectPhoto[],
    [selectedIds, projectPhotos]
  );

  const togglePhoto = useCallback((photoId: string) => {
    setSelectedIds((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId]
    );
  }, []);

  const removeSelected = useCallback((photoId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== photoId));
  }, []);

  const handleDragStart = useCallback((photoId: string) => {
    setDraggedId(photoId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggedId || draggedId === targetId) return;

      setSelectedIds((prev) => {
        const newIds = [...prev];
        const draggedIndex = newIds.indexOf(draggedId);
        const targetIndex = newIds.indexOf(targetId);
        if (draggedIndex === -1 || targetIndex === -1) return prev;

        newIds.splice(draggedIndex, 1);
        newIds.splice(targetIndex, 0, draggedId);
        return newIds;
      });
    },
    [draggedId]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setNameError('Gallery name is required');
      return;
    }
    setNameError('');

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      photoIds: selectedIds,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto">
      <div className="bg-white w-full min-h-screen md:min-h-0 md:max-w-2xl md:my-8 md:rounded-xl md:shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:rounded-t-xl">
          <h2 className="text-lg font-semibold">Create Gallery</h2>
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
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Gallery Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Exterior Progress Photos"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              error={nameError}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <Textarea
              placeholder="Optional description for this gallery..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="border-slate-300 focus:ring-blue-500"
            />
          </div>

          {/* Photo Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Select Photos
              </label>
              <span className="text-xs text-slate-500">
                {selectedIds.length} of {projectPhotos.length} selected
              </span>
            </div>

            {projectPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 rounded-lg border-2 border-dashed border-slate-200">
                <Image className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No photos in this project yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {projectPhotos.map((photo) => {
                  const isSelected = selectedIds.includes(photo.id);
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => togglePhoto(photo.id)}
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
                      {/* Selection overlay */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
                            <Check className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                      {/* Selection index */}
                      {isSelected && (
                        <span className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white">
                          {selectedIds.indexOf(photo.id) + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Photos Reorder List */}
          {selectedPhotos.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Gallery Order
              </label>
              <p className="text-xs text-slate-500">
                Drag to reorder. Photos appear in this sequence.
              </p>
              <div className="space-y-1 rounded-lg border border-slate-200 p-2 max-h-48 overflow-y-auto">
                {selectedPhotos.map((photo, index) => (
                  <div
                    key={photo.id}
                    draggable
                    onDragStart={() => handleDragStart(photo.id)}
                    onDragOver={(e) => handleDragOver(e, photo.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border bg-white p-1.5 transition-colors',
                      draggedId === photo.id
                        ? 'border-blue-300 bg-blue-50 opacity-50'
                        : 'border-slate-100 hover:bg-slate-50'
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-slate-400 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-xs font-medium text-slate-600 flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="h-8 w-8 rounded overflow-hidden flex-shrink-0">
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <span className="text-xs text-slate-500 truncate flex-1">
                      Photo {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSelected(photo.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
              Create Gallery
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
