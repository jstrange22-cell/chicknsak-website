import { useState, useEffect } from 'react';
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
import { Loader2, MapPin, Clock, Building2, Image } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Timeline, Photo, Company, Project } from '@/types';

const PHOTOS_PER_PAGE = 100;

function formatTimestamp(date: unknown): string {
  if (!date) return '';
  // Handle Firestore Timestamp
  const jsDate =
    typeof date === 'object' && date !== null && 'toDate' in date
      ? (date as { toDate: () => Date }).toDate()
      : new Date(date as string | number);

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(jsDate);
}

function formatDateGroup(date: unknown): string {
  if (!date) return '';
  const jsDate =
    typeof date === 'object' && date !== null && 'toDate' in date
      ? (date as { toDate: () => Date }).toDate()
      : new Date(date as string | number);

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(jsDate);
}

function getDateKey(date: unknown): string {
  if (!date) return '';
  const jsDate =
    typeof date === 'object' && date !== null && 'toDate' in date
      ? (date as { toDate: () => Date }).toDate()
      : new Date(date as string | number);

  return jsDate.toISOString().split('T')[0];
}

function groupPhotosByDate(photos: Photo[]): Map<string, Photo[]> {
  const groups = new Map<string, Photo[]>();
  for (const photo of photos) {
    const key = getDateKey(photo.capturedAt);
    const existing = groups.get(key) || [];
    existing.push(photo);
    groups.set(key, existing);
  }
  return groups;
}

export default function ShareTimeline() {
  const { token } = useParams<{ token: string }>();

  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function fetchTimeline() {
      try {
        // Query for the timeline by shareToken and active status
        const timelinesRef = collection(db, 'timelines');
        const q = query(
          timelinesRef,
          where('shareToken', '==', token),
          where('isActive', '==', true)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const timelineDoc = snapshot.docs[0];
        const timelineData = {
          id: timelineDoc.id,
          ...timelineDoc.data(),
        } as Timeline;
        setTimeline(timelineData);

        // Fetch project for name/address
        if (timelineData.projectId) {
          try {
            const projectDoc = await getDoc(
              doc(db, 'projects', timelineData.projectId)
            );
            if (projectDoc.exists()) {
              setProject({
                id: projectDoc.id,
                ...projectDoc.data(),
              } as Project);
            }
          } catch {
            // Project fetch is non-critical
          }
        }

        // Fetch company for branding
        if (timelineData.companyId) {
          try {
            const companyDoc = await getDoc(
              doc(db, 'companies', timelineData.companyId)
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

        // Fetch photos for the project, ordered by capturedAt desc
        if (timelineData.projectId) {
          const photosRef = collection(db, 'photos');
          const photosQuery = query(
            photosRef,
            where('projectId', '==', timelineData.projectId)
          );
          const photosSnapshot = await getDocs(photosQuery);
          const fetchedPhotos = photosSnapshot.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Photo
          );
          fetchedPhotos.sort((a, b) => {
            const aTime = (a.capturedAt as any)?.toDate?.()?.getTime() || 0;
            const bTime = (b.capturedAt as any)?.toDate?.()?.getTime() || 0;
            return bTime - aTime;
          });
          setPhotos(fetchedPhotos.slice(0, PHOTOS_PER_PAGE));
        }
      } catch (error) {
        console.error('Error fetching shared timeline:', error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    fetchTimeline();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (notFound || !timeline) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <Clock className="mb-4 h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-semibold text-slate-700">Timeline not found</h1>
        <p className="mt-2 text-sm text-slate-500">
          This timeline is no longer available or the link may have expired.
        </p>
      </div>
    );
  }

  const visiblePhotos = photos.slice(0, visibleCount);
  const hasMore = visibleCount < photos.length;
  const dateGroups = groupPhotosByDate(visiblePhotos);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Company Header Bar */}
      {company && (
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
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

      {/* Project Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {project ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {project.name}
              </h1>
              {project.addressFull && (
                <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span>{project.addressFull}</span>
                </div>
              )}
            </>
          ) : (
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Project Timeline
            </h1>
          )}
          <p className="mt-2 text-sm text-slate-400">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'} in timeline
          </p>
        </div>
      </div>

      {/* Timeline Feed */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        {photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20">
            <Image className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              No photos in this timeline yet.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {Array.from(dateGroups.entries()).map(([dateKey, datePhotos]) => (
              <div key={dateKey}>
                {/* Date Group Header */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50">
                    <Clock className="h-4 w-4 text-blue-500" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-700">
                    {formatDateGroup(datePhotos[0].capturedAt)}
                  </h2>
                </div>

                {/* Photos for this date */}
                <div className="space-y-4 pl-11">
                  {datePhotos.map((photo) => (
                    <Card key={photo.id} className="overflow-hidden">
                      {/* Photo */}
                      <div className="relative bg-slate-100">
                        <img
                          src={photo.annotatedUrl || photo.url}
                          alt={photo.description || 'Timeline photo'}
                          className="w-full object-cover"
                          style={{ maxHeight: '500px' }}
                          loading="lazy"
                        />
                      </div>

                      <CardContent className="p-4">
                        {/* Timestamp */}
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Clock className="h-3.5 w-3.5" />
                          <time>{formatTimestamp(photo.capturedAt)}</time>
                        </div>

                        {/* Description */}
                        {photo.description && (
                          <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            {photo.description}
                          </p>
                        )}

                        {/* AI Caption fallback */}
                        {!photo.description && photo.aiCaption && (
                          <p className="mt-2 text-sm italic leading-relaxed text-slate-500">
                            {photo.aiCaption}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setVisibleCount((prev) => prev + 20)}
            >
              Load more photos
            </Button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <p className="text-center text-xs text-slate-400">
            Generated by ProjectWorks
          </p>
        </div>
      </div>
    </div>
  );
}
