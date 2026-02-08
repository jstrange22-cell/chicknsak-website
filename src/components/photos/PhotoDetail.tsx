import { useState } from 'react';
import type { Photo, PhotoTag, Tag } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  Tag as TagIcon,
  MapPin,
  Calendar,
  User,
  MessageCircle,
  MoreVertical,
  Share2,
  Edit2,
  ExternalLink,
  PenTool,
} from 'lucide-react';
import { format } from 'date-fns';
import { TagSelector } from './TagSelector';
import { PhotoAnnotator } from './PhotoAnnotator';
import { useUpdatePhoto, useDeletePhoto, useAddPhotoTag, useRemovePhotoTag } from '@/hooks/usePhotos';
import { useAuth } from '@/hooks/useAuth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '@/lib/firebase';
import { dataUrlToBlob } from '@/lib/imageProcessing';
import { logActivity } from '@/lib/activityLogger';

interface PhotoWithTags extends Photo {
  tags: PhotoTag[];
}

interface PhotoDetailProps {
  photo: PhotoWithTags;
  photos?: PhotoWithTags[];
  tags?: Tag[];
  onClose: () => void;
  onNavigate?: (photo: PhotoWithTags) => void;
}

export function PhotoDetail({
  photo,
  photos = [],
  tags = [],
  onClose,
  onNavigate,
}: PhotoDetailProps) {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';
  const isPhotoOwner = user?.uid === photo.uploadedBy;
  const canDeletePhoto = isAdmin || isPhotoOwner;
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(photo.description || '');
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAnnotator, setShowAnnotator] = useState(false);
  const [viewMode, setViewMode] = useState<'original' | 'annotated'>(
    photo.annotatedUrl ? 'annotated' : 'original'
  );

  const updatePhoto = useUpdatePhoto();
  const deletePhoto = useDeletePhoto();
  const addTag = useAddPhotoTag();
  const removeTag = useRemovePhotoTag();

  const currentIndex = photos.findIndex((p) => p.id === photo.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  const handlePrev = () => {
    if (hasPrev && onNavigate) onNavigate(photos[currentIndex - 1]);
  };

  const handleNext = () => {
    if (hasNext && onNavigate) onNavigate(photos[currentIndex + 1]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') onClose();
  };

  const handleSaveDescription = async () => {
    await updatePhoto.mutateAsync({ photoId: photo.id, updates: { description } });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!user) return;
    if (window.confirm('Are you sure you want to delete this photo?')) {
      await deletePhoto.mutateAsync({
        photoId: photo.id,
        userId: user.uid,
        companyId: photo.companyId,
      });
      onClose();
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = `photo-${photo.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddTag = async (tagId: string) => {
    await addTag.mutateAsync({ photoId: photo.id, tagId });
    setShowTagSelector(false);
  };

  const handleRemoveTag = async (tagId: string) => {
    await removeTag.mutateAsync({ photoId: photo.id, tagId });
  };

  const handleAnnotationSave = async (dataUrl: string, shapes: unknown[]) => {
    if (!user) return;

    try {
      const blob = dataUrlToBlob(dataUrl);
      const storagePath = `photos/${photo.companyId}/${photo.projectId}/annotated_${Date.now()}.jpg`;
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const annotatedUrl = await getDownloadURL(snapshot.ref);

      await updatePhoto.mutateAsync({
        photoId: photo.id,
        updates: { annotatedUrl },
      });

      await addDoc(collection(db, 'annotations'), {
        photoId: photo.id,
        userId: user.uid,
        annotationData: { shapes, version: 1 },
        annotatedImageUrl: annotatedUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logActivity({
        companyId: photo.companyId,
        projectId: photo.projectId,
        userId: user.uid,
        activityType: 'photo_annotated',
        message: 'annotated a photo',
        entityType: 'photo',
        entityId: photo.id,
      });

      setShowAnnotator(false);
      setViewMode('annotated');
    } catch (err) {
      console.error('Error saving annotation:', err);
    }
  };

  const capturedDate = photo.capturedAt
    ? photo.capturedAt instanceof Date
      ? photo.capturedAt
      : photo.capturedAt.toDate()
    : null;

  const displayUrl = viewMode === 'annotated' && photo.annotatedUrl ? photo.annotatedUrl : photo.url;

  if (showAnnotator) {
    return (
      <PhotoAnnotator
        imageUrl={photo.url}
        onSave={handleAnnotationSave}
        onCancel={() => setShowAnnotator(false)}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={onClose}>
          <X className="w-6 h-6" />
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setShowAnnotator(true)}>
            <PenTool className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setShowTagSelector(true)}>
            <TagIcon className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={handleDownload}>
            <Download className="w-5 h-5" />
          </Button>
          <div className="relative">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setShowMenu(!showMenu)}>
              <MoreVertical className="w-5 h-5" />
            </Button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg py-1 z-50">
                <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2" onClick={() => { setIsEditing(true); setShowMenu(false); }}>
                  <Edit2 className="w-4 h-4" /> Edit description
                </button>
                <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2" onClick={() => setShowMenu(false)}>
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2" onClick={() => { window.open(photo.url, '_blank'); setShowMenu(false); }}>
                  <ExternalLink className="w-4 h-4" /> Open original
                </button>
                {canDeletePhoto && (
                  <>
                    <hr className="my-1" />
                    <button className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600" onClick={handleDelete}>
                      <Trash2 className="w-4 h-4" /> Delete photo
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Original / Annotated toggle */}
      {photo.annotatedUrl && (
        <div className="flex justify-center gap-1 py-2 bg-black/60">
          <button
            onClick={() => setViewMode('original')}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-colors",
              viewMode === 'original' ? "bg-white text-black" : "text-white/70 hover:text-white"
            )}
          >
            Original
          </button>
          <button
            onClick={() => setViewMode('annotated')}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-colors",
              viewMode === 'annotated' ? "bg-white text-black" : "text-white/70 hover:text-white"
            )}
          >
            Annotated
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {hasPrev && (
          <button className="absolute left-4 z-10 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors" onClick={handlePrev}>
            <ChevronLeft className="w-8 h-8" />
          </button>
        )}
        {hasNext && (
          <button className="absolute right-4 z-10 w-12 h-12 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors" onClick={handleNext}>
            <ChevronRight className="w-8 h-8" />
          </button>
        )}

        <img src={displayUrl} alt={photo.description || 'Project photo'} className="max-w-full max-h-full object-contain" />

        {photo.photoType && photo.photoType !== 'standard' && (
          <div className={cn(
            'absolute top-4 left-4 px-3 py-1 rounded text-sm font-medium text-white',
            photo.photoType === 'before' && 'bg-blue-500',
            photo.photoType === 'after' && 'bg-green-500',
            photo.photoType === 'internal' && 'bg-purple-500'
          )}>
            {photo.photoType.charAt(0).toUpperCase() + photo.photoType.slice(1)}
          </div>
        )}
      </div>

      {/* Bottom info panel */}
      <div className="bg-gray-900 p-4 space-y-3">
        <div>
          {isEditing ? (
            <div className="flex gap-2">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add a description..." className="flex-1 bg-gray-800 border-gray-700 text-white" autoFocus />
              <Button size="sm" onClick={handleSaveDescription} disabled={updatePhoto.isPending}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setDescription(photo.description || ''); setIsEditing(false); }}>Cancel</Button>
            </div>
          ) : (
            <p className={cn('text-white cursor-pointer hover:text-gray-300', !photo.description && 'text-gray-500 italic')} onClick={() => setIsEditing(true)}>
              {photo.description || 'Add a description...'}
            </p>
          )}
        </div>

        {photo.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photo.tags.map((photoTag) => {
              const tag = tags.find((t) => t.id === photoTag.tagId);
              return (
                <span key={photoTag.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-white" style={{ backgroundColor: tag?.color || '#6B7280' }}>
                  {tag?.name || 'Unknown'}
                  <button className="hover:bg-white/20 rounded-full p-0.5" onClick={() => handleRemoveTag(photoTag.tagId)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
          {capturedDate && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{format(capturedDate, 'MMM d, yyyy h:mm a')}</span>
            </div>
          )}
          {photo.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{photo.location.latitude.toFixed(5)}, {photo.location.longitude.toFixed(5)}</span>
            </div>
          )}
          {photo.uploadedBy && (
            <div className="flex items-center gap-1">
              <User className="w-4 h-4" />
              <span>{photo.uploadedBy}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            <span>0 comments</span>
          </div>
        </div>

        {photos.length > 1 && (
          <div className="text-center text-sm text-gray-500">
            {currentIndex + 1} of {photos.length}
          </div>
        )}
      </div>

      {showTagSelector && (
        <TagSelector
          tags={tags}
          selectedTagIds={photo.tags.map((t) => t.tagId)}
          onSelect={handleAddTag}
          onClose={() => setShowTagSelector(false)}
        />
      )}
    </div>
  );
}
