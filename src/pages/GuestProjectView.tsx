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
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Building2,
  Image,
  MapPin,
  Shield,
  Clock,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Collaborator, Photo, Company, Project } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PHOTOS_LIMIT = 200;

const ROLE_LABELS: Record<string, string> = {
  viewer: 'Viewer',
  contributor: 'Contributor',
  subcontractor: 'Subcontractor',
};

const ROLE_COLORS: Record<string, string> = {
  viewer: 'bg-slate-100 text-slate-700',
  contributor: 'bg-blue-100 text-blue-700',
  subcontractor: 'bg-amber-100 text-amber-700',
};

// ---------------------------------------------------------------------------
// Lightbox (inline, mirrors ShareGallery pattern)
// ---------------------------------------------------------------------------

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
          src={photo.annotatedUrl || photo.url}
          alt={photo.description || 'Project photo'}
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

// ---------------------------------------------------------------------------
// Page States
// ---------------------------------------------------------------------------

type PageState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'expired'; collaborator: Collaborator; company: Company | null; project: Project | null }
  | {
      kind: 'ready';
      collaborator: Collaborator;
      company: Company | null;
      project: Project;
      photos: Photo[];
    };

// ---------------------------------------------------------------------------
// Helper: format a Firestore Timestamp for display
// ---------------------------------------------------------------------------

function formatTimestamp(ts: { toDate?: () => Date } | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(ts.toDate());
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function GuestProjectView() {
  const { token } = useParams<{ token: string }>();

  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // ------ data fetching ------
  useEffect(() => {
    if (!token) {
      setState({ kind: 'not_found' });
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        // 1. Look up collaborator by accessToken
        const collabQuery = query(
          collection(db, 'collaborators'),
          where('accessToken', '==', token)
        );
        const collabSnap = await getDocs(collabQuery);

        if (collabSnap.empty) {
          if (!cancelled) setState({ kind: 'not_found' });
          return;
        }

        const collabDoc = collabSnap.docs[0];
        const collaborator = { id: collabDoc.id, ...collabDoc.data() } as Collaborator;

        // 2. Check expiry
        const isExpired =
          collaborator.expiresAt &&
          typeof collaborator.expiresAt.toDate === 'function' &&
          collaborator.expiresAt.toDate() < new Date();

        // 3. Fetch company (non-critical)
        let company: Company | null = null;
        if (collaborator.companyId) {
          try {
            const companyDoc = await getDoc(doc(db, 'companies', collaborator.companyId));
            if (companyDoc.exists()) {
              company = { id: companyDoc.id, ...companyDoc.data() } as Company;
            }
          } catch {
            // Company branding is non-critical; continue without it
          }
        }

        // 4. Fetch project
        let project: Project | null = null;
        if (collaborator.projectId) {
          try {
            const projectDoc = await getDoc(doc(db, 'projects', collaborator.projectId));
            if (projectDoc.exists()) {
              project = { id: projectDoc.id, ...projectDoc.data() } as Project;
            }
          } catch {
            // If we can't read the project, treat as not found
          }
        }

        // If expired, stop here and show expiry screen
        if (isExpired) {
          if (!cancelled) {
            setState({ kind: 'expired', collaborator, company, project });
          }
          return;
        }

        // If we couldn't load the project, treat the link as invalid
        if (!project) {
          if (!cancelled) setState({ kind: 'not_found' });
          return;
        }

        // 5. Fetch photos (only if the collaborator has viewPhotos permission)
        let photos: Photo[] = [];
        if (collaborator.permissions?.viewPhotos) {
          try {
            const photosQuery = query(
              collection(db, 'photos'),
              where('projectId', '==', collaborator.projectId)
            );
            const photosSnap = await getDocs(photosQuery);
            photos = photosSnap.docs.map(
              (d) => ({ id: d.id, ...d.data() }) as Photo
            );
            photos.sort((a, b) => {
              const aTime = (a.capturedAt as any)?.toDate?.()?.getTime() || 0;
              const bTime = (b.capturedAt as any)?.toDate?.()?.getTime() || 0;
              return bTime - aTime;
            });
            photos = photos.slice(0, PHOTOS_LIMIT);
          } catch (err) {
            console.error('Error fetching project photos:', err);
          }
        }

        if (!cancelled) {
          setState({ kind: 'ready', collaborator, company, project, photos });
        }
      } catch (err) {
        console.error('Error loading guest project view:', err);
        if (!cancelled) setState({ kind: 'not_found' });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ------ lightbox navigation ------
  const handlePrev = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev === null) return prev;
      if (state.kind !== 'ready') return prev;
      return prev === 0 ? state.photos.length - 1 : prev - 1;
    });
  }, [state]);

  const handleNext = useCallback(() => {
    setSelectedIndex((prev) => {
      if (prev === null) return prev;
      if (state.kind !== 'ready') return prev;
      return prev === state.photos.length - 1 ? 0 : prev + 1;
    });
  }, [state]);

  const handleClose = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  // ------ Loading State ------
  if (state.kind === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-sm text-slate-500">Loading project...</p>
        </div>
      </div>
    );
  }

  // ------ Not Found State ------
  if (state.kind === 'not_found') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <AlertTriangle className="h-8 w-8 text-slate-400" />
          </div>
          <h1 className="text-xl font-semibold text-slate-700">Link not found</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            This project link is invalid or has been revoked. Please contact the
            person who shared it with you for a new link.
          </p>
        </div>
      </div>
    );
  }

  // ------ Expired State ------
  if (state.kind === 'expired') {
    const { collaborator, company, project } = state;
    return (
      <div className="min-h-screen bg-slate-50">
        <CompanyHeader company={company} />
        <div className="flex flex-col items-center justify-center px-4 py-20">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <h1 className="text-xl font-semibold text-slate-700">Access expired</h1>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Your access to{' '}
              <span className="font-medium text-slate-700">
                {project?.name ?? 'this project'}
              </span>{' '}
              expired
              {collaborator.expiresAt
                ? ` on ${formatTimestamp(collaborator.expiresAt)}`
                : ''}
              . Please contact the project owner for renewed access.
            </p>
          </div>
        </div>
        <PageFooter />
      </div>
    );
  }

  // ------ Ready State ------
  const { collaborator, company, project, photos } = state;
  const hasViewPermission = collaborator.permissions?.viewPhotos;

  const projectAddress = [
    project.addressStreet,
    project.addressCity,
    project.addressState,
    project.addressZip,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Company Branding Header */}
      <CompanyHeader company={company} />

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Project Info */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {project.name}
          </h1>

          {projectAddress && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span>{projectAddress}</span>
            </div>
          )}

          {/* Role Badge */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
                ROLE_COLORS[collaborator.role] ?? 'bg-slate-100 text-slate-700'
              )}
            >
              <Shield className="h-3 w-3" />
              {ROLE_LABELS[collaborator.role] ?? collaborator.role}
            </span>

            {collaborator.permissions?.addPhotos && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                Can add photos
              </span>
            )}

            {collaborator.permissions?.addComments && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                Can comment
              </span>
            )}
          </div>

          {project.description && (
            <p className="mt-4 text-sm text-slate-600">{project.description}</p>
          )}
        </div>

        {/* Photo Section */}
        {hasViewPermission ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">
                Project Photos
              </h2>
              <p className="text-sm text-slate-400">
                {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
              </p>
            </div>

            {photos.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Image className="mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-medium text-slate-500">
                    No photos yet
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Photos added to this project will appear here.
                  </p>
                </CardContent>
              </Card>
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
                      alt={photo.description || 'Project photo'}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                    {photo.photoType && photo.photoType !== 'standard' && (
                      <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                        {photo.photoType}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Shield className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                Photo access not included
              </p>
              <p className="mt-1 max-w-xs text-center text-xs text-slate-400">
                Your current permissions do not include viewing project photos.
                Contact the project owner if you need access.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <PageFooter />

      {/* Lightbox */}
      {selectedIndex !== null && state.kind === 'ready' && (
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CompanyHeader({ company }: { company: Company | null }) {
  if (!company) return null;

  return (
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
  );
}

function PageFooter() {
  return (
    <div className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-4">
        <p className="text-center text-xs text-slate-400">
          Powered by ProjectWorks
        </p>
      </div>
    </div>
  );
}
