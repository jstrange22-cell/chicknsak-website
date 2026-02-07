import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, X, ChevronLeft, ChevronRight, Building2, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Gallery, Photo, Company } from '@/types';

function Lightbox({
  photos,
  currentIndex,
  onClose,
  onPrev,
  onNext,
}: {
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const photo = photos[currentIndex];

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrev, onNext]);

  if (!photo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
        aria-label="Close lightbox"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Previous button */}
      {photos.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
          aria-label="Previous photo"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Photo */}
      <div
        className="flex max-h-[90vh] max-w-[90vw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.annotatedUrl || photo.url}
          alt={photo.description || 'Gallery photo'}
          className="max-h-[85vh] max-w-full rounded object-contain"
        />
        {photo.description && (
          <p className="mt-3 max-w-xl text-center text-sm text-white/80">
            {photo.description}
          </p>
        )}
        <p className="mt-1 text-xs text-white/50">
          {currentIndex + 1} of {photos.length}
        </p>
      </div>

      {/* Next button */}
      {photos.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
          aria-label="Next photo"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}

export default function ShareGallery() {
  const { token } = useParams<{ token: string }>();

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function fetchGallery() {
      try {
        // Query for the gallery by shareToken and active status
        const galleriesRef = collection(db, 'galleries');
        const q = query(
          galleriesRef,
          where('shareToken', '==', token),
          where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const galleryDoc = snapshot.docs[0];
        const galleryData = { id: galleryDoc.id, ...galleryDoc.data() } as Gallery;
        setGallery(galleryData);

        // Fetch company for branding
        if (galleryData.companyId) {
          try {
            const companyDoc = await getDoc(doc(db, 'companies', galleryData.companyId));
            if (companyDoc.exists()) {
              setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
            }
          } catch {
            // Company fetch is non-critical
          }
        }

        // Fetch all photos by their IDs
        if (galleryData.photoIds.length > 0) {
          const fetchedPhotos: Photo[] = [];
          const batchSize = 10;

          for (let i = 0; i < galleryData.photoIds.length; i += batchSize) {
            const batch = galleryData.photoIds.slice(i, i + batchSize);
            const promises = batch.map((photoId) =>
              getDoc(doc(db, 'photos', photoId))
            );
            const results = await Promise.all(promises);
            results.forEach((photoDoc) => {
              if (photoDoc.exists()) {
                fetchedPhotos.push({
                  id: photoDoc.id,
                  ...photoDoc.data(),
                } as Photo);
              }
            });
          }

          // Preserve the order from gallery.photoIds
          const photoMap = new Map(fetchedPhotos.map((p) => [p.id, p]));
          const orderedPhotos = galleryData.photoIds
            .map((id) => photoMap.get(id))
            .filter((p): p is Photo => p !== undefined);

          setPhotos(orderedPhotos);
        }
      } catch (error) {
        console.error('Error fetching shared gallery:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchGallery();
  }, [token]);

  const handlePrev = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev === null || photos.length === 0) return prev;
      return prev === 0 ? photos.length - 1 : prev - 1;
    });
  }, [photos.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev === null || photos.length === 0) return prev;
      return prev === photos.length - 1 ? 0 : prev + 1;
    });
  }, [photos.length]);

  const handleClose = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (notFound || !gallery) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <Image className="mb-4 h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-semibold text-slate-700">Gallery not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          This gallery is no longer available or the link may have expired.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Company Header Bar */}
      {company && (
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={company.name}
                className="h-8 w-8 rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                <Building2 className="h-4 w-4 text-slate-400" />
              </div>
            )}
            <span className="text-sm font-medium text-slate-700">{company.name}</span>
          </div>
        </div>
      )}

      {/* Gallery Content */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Gallery Info */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {gallery.name}
          </h1>
          {gallery.description && (
            <p className="mt-2 text-base text-slate-600">{gallery.description}</p>
          )}
          <p className="mt-2 text-sm text-slate-400">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </p>
        </div>

        {/* Photo Grid */}
        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20">
            <Image className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No photos in this gallery yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'group relative aspect-square overflow-hidden rounded-lg bg-slate-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                  'transition-shadow hover:shadow-md'
                )}
              >
                <img
                  src={photo.thumbnailUrl || photo.url}
                  alt={photo.description || 'Gallery photo'}
                  className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <p className="text-center text-xs text-slate-400">
            Generated by JobMate
          </p>
        </div>
      </div>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <Lightbox
          photos={photos}
          currentIndex={selectedIndex}
          onClose={handleClose}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}
    </div>
  );
}
