import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Building2, Image, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BeforeAfterSlider } from '@/components/showcase/BeforeAfterSlider';
import type { Showcase, Photo, Company } from '@/types';

// Inline lightbox for gallery photos (same pattern as ShareGallery)
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
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
        aria-label="Close lightbox"
      >
        <X className="h-6 w-6" />
      </button>

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

      <div
        className="flex max-h-[90vh] max-w-[90vw] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.url}
          alt={photo.description || 'Showcase photo'}
          className="max-h-[85vh] max-w-full rounded object-contain"
        />
        <p className="mt-1 text-xs text-white/50">
          {currentIndex + 1} of {photos.length}
        </p>
      </div>

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

export default function PublicShowcase() {
  const { slug } = useParams<{ slug: string }>();

  const [showcase, setShowcase] = useState<Showcase | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [beforePhoto, setBeforePhoto] = useState<Photo | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<Photo | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function fetchShowcase() {
      try {
        // Query for the showcase by slug where published
        const showcasesRef = collection(db, 'showcases');
        const q = query(
          showcasesRef,
          where('slug', '==', slug),
          where('isPublished', '==', true)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const showcaseDoc = snapshot.docs[0];
        const showcaseData = {
          id: showcaseDoc.id,
          ...showcaseDoc.data(),
        } as Showcase;
        setShowcase(showcaseData);

        // Fetch company for branding
        if (showcaseData.companyId) {
          try {
            const companyDoc = await getDoc(
              doc(db, 'companies', showcaseData.companyId)
            );
            if (companyDoc.exists()) {
              setCompany({
                id: companyDoc.id,
                ...companyDoc.data(),
              } as Company);
            }
          } catch {
            // Company fetch is non-critical
          }
        }

        // Fetch before photo
        if (showcaseData.beforePhotoId) {
          try {
            const photoDoc = await getDoc(
              doc(db, 'photos', showcaseData.beforePhotoId)
            );
            if (photoDoc.exists()) {
              setBeforePhoto({
                id: photoDoc.id,
                ...photoDoc.data(),
              } as Photo);
            }
          } catch {
            // Non-critical
          }
        }

        // Fetch after photo
        if (showcaseData.afterPhotoId) {
          try {
            const photoDoc = await getDoc(
              doc(db, 'photos', showcaseData.afterPhotoId)
            );
            if (photoDoc.exists()) {
              setAfterPhoto({
                id: photoDoc.id,
                ...photoDoc.data(),
              } as Photo);
            }
          } catch {
            // Non-critical
          }
        }

        // Fetch gallery photos
        if (
          showcaseData.galleryPhotoIds &&
          showcaseData.galleryPhotoIds.length > 0
        ) {
          const fetchedPhotos: Photo[] = [];
          const batchSize = 10;

          for (
            let i = 0;
            i < showcaseData.galleryPhotoIds.length;
            i += batchSize
          ) {
            const batch = showcaseData.galleryPhotoIds.slice(
              i,
              i + batchSize
            );
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

          // Preserve order from galleryPhotoIds
          const photoMap = new Map(fetchedPhotos.map((p) => [p.id, p]));
          const orderedPhotos = showcaseData.galleryPhotoIds
            .map((id) => photoMap.get(id))
            .filter((p): p is Photo => p !== undefined);

          setGalleryPhotos(orderedPhotos);
        }
      } catch (error) {
        console.error('Error fetching showcase:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchShowcase();
  }, [slug]);

  const handlePrev = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev === null || galleryPhotos.length === 0) return prev;
      return prev === 0 ? galleryPhotos.length - 1 : prev - 1;
    });
  }, [galleryPhotos.length]);

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev === null || galleryPhotos.length === 0) return prev;
      return prev === galleryPhotos.length - 1 ? 0 : prev + 1;
    });
  }, [galleryPhotos.length]);

  const handleClose = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Not found state
  if (notFound || !showcase) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <Image className="mb-4 h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-semibold text-slate-700">
          Showcase not found
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          This showcase is no longer available or the link may have expired.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Company Header Bar */}
      {company && (
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
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
            <span className="text-sm font-medium text-slate-700">
              {company.name}
            </span>
          </div>
        </div>
      )}

      {/* Showcase Content */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Title */}
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {showcase.title}
        </h1>

        {/* Description */}
        {showcase.description && (
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            {showcase.description}
          </p>
        )}

        {/* Before/After Slider */}
        {beforePhoto && afterPhoto && (
          <div className="mt-8">
            <BeforeAfterSlider
              beforeUrl={beforePhoto.url}
              afterUrl={afterPhoto.url}
              className="aspect-video w-full max-h-[600px]"
            />
          </div>
        )}

        {/* Gallery Grid */}
        {galleryPhotos.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">
              Project Gallery
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {galleryPhotos.map((photo, index) => (
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
                    alt={photo.description || 'Showcase photo'}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <p className="text-center text-xs text-slate-400">
            Generated by JobMate
          </p>
        </div>
      </div>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <Lightbox
          photos={galleryPhotos}
          currentIndex={selectedIndex}
          onClose={handleClose}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}
    </div>
  );
}
