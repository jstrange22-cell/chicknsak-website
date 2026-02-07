import { Share2, Trash2, Image } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { Gallery } from '@/types';

interface GalleryCardProps {
  gallery: Gallery;
  photoCount: number;
  firstPhotoUrl?: string;
  onShare: (shareToken: string) => void;
  onDelete: (id: string) => void;
}

export function GalleryCard({
  gallery,
  photoCount,
  firstPhotoUrl,
  onShare,
  onDelete,
}: GalleryCardProps) {
  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow">
      {/* Cover Image */}
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300">
        {firstPhotoUrl ? (
          <img
            src={firstPhotoUrl}
            alt={gallery.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Image className="h-12 w-12 text-slate-400" />
          </div>
        )}

        {/* Active/Inactive Badge */}
        <div className="absolute top-2 right-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur-sm',
              gallery.isActive
                ? 'bg-emerald-500/90 text-white'
                : 'bg-slate-500/90 text-white'
            )}
          >
            {gallery.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">{gallery.name}</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => onShare(gallery.shareToken)}
              className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Share gallery"
            >
              <Share2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(gallery.id)}
              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Delete gallery"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Description */}
        {gallery.description && (
          <p className="text-xs text-slate-500 mt-2 line-clamp-2">
            {gallery.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
