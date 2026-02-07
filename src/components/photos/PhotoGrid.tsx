import { useState } from 'react';
import type { Photo, PhotoTag } from '@/types';
import { cn } from '@/lib/utils';
import { Check, Tag, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PhotoWithTags extends Photo {
  tags: PhotoTag[];
}

interface PhotoGridProps {
  photos: PhotoWithTags[];
  isLoading?: boolean;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  onPhotoClick?: (photo: PhotoWithTags) => void;
}

export function PhotoGrid({
  photos,
  isLoading = false,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onPhotoClick,
}: PhotoGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const toggleSelection = (photoId: string) => {
    if (!onSelectionChange) return;

    const newSelection = selectedIds.includes(photoId)
      ? selectedIds.filter((id) => id !== photoId)
      : [...selectedIds, photoId];

    onSelectionChange(newSelection);
  };

  const handleClick = (photo: PhotoWithTags, e: React.MouseEvent) => {
    if (selectable) {
      e.preventDefault();
      toggleSelection(photo.id);
    } else if (onPhotoClick) {
      onPhotoClick(photo);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-gray-200 animate-pulse rounded"
          />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium">No photos yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Tap the camera button to add photos
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1">
      {photos.map((photo) => {
        const isSelected = selectedIds.includes(photo.id);
        const isHovered = hoveredId === photo.id;
        const commentCount = 0; // TODO: Add comment count to photo

        return (
          <div
            key={photo.id}
            className={cn(
              'relative aspect-square cursor-pointer group overflow-hidden rounded',
              isSelected && 'ring-2 ring-orange-500 ring-offset-2'
            )}
            onMouseEnter={() => setHoveredId(photo.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={(e) => handleClick(photo, e)}
          >
            {/* Thumbnail */}
            <img
              src={photo.thumbnailUrl || photo.url}
              alt={photo.description || 'Project photo'}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            {/* Hover overlay */}
            <div
              className={cn(
                'absolute inset-0 bg-black/40 transition-opacity',
                isHovered || isSelected ? 'opacity-100' : 'opacity-0'
              )}
            />

            {/* Selection checkbox */}
            {selectable && (
              <div
                className={cn(
                  'absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                  isSelected
                    ? 'bg-orange-500 border-orange-500'
                    : 'border-white bg-black/20'
                )}
              >
                {isSelected && <Check className="w-4 h-4 text-white" />}
              </div>
            )}

            {/* Photo type badge */}
            {photo.photoType && photo.photoType !== 'standard' && (
              <div
                className={cn(
                  'absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium text-white',
                  photo.photoType === 'before' && 'bg-blue-500',
                  photo.photoType === 'after' && 'bg-green-500',
                  photo.photoType === 'internal' && 'bg-purple-500'
                )}
              >
                {photo.photoType.charAt(0).toUpperCase() + photo.photoType.slice(1)}
              </div>
            )}

            {/* Bottom info bar */}
            <div
              className={cn(
                'absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent transition-opacity',
                isHovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <div className="flex items-center justify-between text-white text-xs">
                <span>
                  {photo.capturedAt
                    ? formatDistanceToNow(
                        photo.capturedAt instanceof Date
                          ? photo.capturedAt
                          : photo.capturedAt.toDate(),
                        { addSuffix: true }
                      )
                    : ''}
                </span>
                <div className="flex items-center gap-2">
                  {photo.tags.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      <span>{photo.tags.length}</span>
                    </div>
                  )}
                  {commentCount > 0 && (
                    <div className="flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      <span>{commentCount}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tag color dots */}
            {photo.tags.length > 0 && !isHovered && (
              <div className="absolute bottom-2 left-2 flex gap-1">
                {photo.tags.slice(0, 3).map((tag, index) => (
                  <div
                    key={index}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: tag.tagId }}
                  />
                ))}
                {photo.tags.length > 3 && (
                  <div className="w-2 h-2 rounded-full bg-white/50" />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
