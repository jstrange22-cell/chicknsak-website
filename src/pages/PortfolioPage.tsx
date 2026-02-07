import { useState, useEffect, useMemo } from 'react';
import {
  Briefcase,
  Plus,
  X,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  Image,
  Globe,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { Showcase, Project } from '@/types';

// ---------------------------------------------------------------------------
// Create Showcase Modal
// ---------------------------------------------------------------------------

interface CreateShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (showcase: Showcase) => void;
  projects: Project[];
  companyId: string;
}

function CreateShowcaseModal({
  isOpen,
  onClose,
  onCreated,
  projects,
  companyId,
}: CreateShowcaseModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setProjectId('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!projectId) {
      setError('Please select a project.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const slug = title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const data: Record<string, unknown> = {
        companyId,
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        beforePhotoId: undefined,
        afterPhotoId: undefined,
        galleryPhotoIds: [],
        isPublished: false,
        slug,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'showcases'), data);
      const created = { id: docRef.id, ...data } as unknown as Showcase;
      onCreated(created);
      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to create showcase:', err);
      setError('Failed to create showcase. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Create Showcase</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g., Modern Kitchen Remodel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              placeholder="Describe this showcase project..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            />
          </div>

          {/* Project */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Project <span className="text-red-500">*</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <option value="">Select a project...</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            <Plus className="h-4 w-4" />
            Create Showcase
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

interface DeleteConfirmModalProps {
  isOpen: boolean;
  showcaseTitle: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

function DeleteConfirmModal({ isOpen, showcaseTitle, onClose, onConfirm, isDeleting }: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Showcase</h3>
          <p className="text-sm text-slate-500 mb-6">
            Are you sure you want to delete <span className="font-medium text-slate-700">{showcaseTitle}</span>? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm} isLoading={isDeleting}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PortfolioPage() {
  const { profile } = useAuthContext();

  // Data
  const [showcases, setShowcases] = useState<Showcase[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Showcase | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [publishFilter, setPublishFilter] = useState<'all' | 'published' | 'draft'>('all');

  // ------ Load data from Firestore ------
  useEffect(() => {
    if (!profile?.companyId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch showcases and projects in parallel
        const [showcaseSnap, projectSnap] = await Promise.all([
          getDocs(
            query(
              collection(db, 'showcases'),
              where('companyId', '==', profile!.companyId),
            )
          ),
          getDocs(
            query(
              collection(db, 'projects'),
              where('companyId', '==', profile!.companyId)
            )
          ),
        ]);

        if (cancelled) return;

        const showcaseData = showcaseSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Showcase));
        showcaseData.sort((a, b) => {
          const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
          const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
          return bTime - aTime;
        });
        setShowcases(showcaseData
        );
        setProjects(
          projectSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Project))
        );
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load portfolio data:', err);
        setError('Failed to load showcases. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [profile?.companyId]);

  // ------ Project name lookup ------
  const projectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, p.name);
    }
    return map;
  }, [projects]);

  // ------ Stats ------
  const stats = useMemo(() => {
    const total = showcases.length;
    const published = showcases.filter((s) => s.isPublished).length;
    const draft = total - published;
    return { total, published, draft };
  }, [showcases]);

  // ------ Filtered showcases ------
  const filteredShowcases = useMemo(() => {
    return showcases.filter((s) => {
      if (publishFilter === 'published' && !s.isPublished) return false;
      if (publishFilter === 'draft' && s.isPublished) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesDesc = s.description?.toLowerCase().includes(q);
        const projectName = projectMap.get(s.projectId) || '';
        const matchesProject = projectName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesProject) return false;
      }
      return true;
    });
  }, [showcases, publishFilter, searchQuery, projectMap]);

  // ------ Handlers ------
  const handleCreated = (showcase: Showcase) => {
    setShowcases((prev) => [showcase, ...prev]);
  };

  const handleTogglePublish = async (showcase: Showcase) => {
    setTogglingId(showcase.id);
    try {
      const newValue = !showcase.isPublished;
      await updateDoc(doc(db, 'showcases', showcase.id), {
        isPublished: newValue,
        updatedAt: serverTimestamp(),
      });
      setShowcases((prev) =>
        prev.map((s) =>
          s.id === showcase.id ? { ...s, isPublished: newValue } : s
        )
      );
    } catch (err) {
      console.error('Failed to toggle publish status:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'showcases', deleteTarget.id));
      setShowcases((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete showcase:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // ------ Render ------
  return (
    <div className="flex flex-col min-h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Portfolio</h1>
          <p className="text-slate-500 text-sm">
            Build and share a public portfolio of your completed projects.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          Create Showcase
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                <Briefcase className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total</p>
                <p className="text-xl font-bold text-slate-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <Globe className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Published</p>
                <p className="text-xl font-bold text-slate-900">{stats.published}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <EyeOff className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Drafts</p>
                <p className="text-xl font-bold text-slate-900">{stats.draft}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search showcases by title, description, or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          />
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          {(['all', 'published', 'draft'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPublishFilter(f)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                publishFilter === f
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg border border-slate-200 py-20">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : filteredShowcases.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg border border-slate-200 py-20">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Briefcase className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {showcases.length > 0 ? 'No matching showcases' : 'No showcases yet'}
          </h3>
          <p className="text-sm text-slate-500 max-w-[280px] text-center leading-relaxed">
            {showcases.length > 0
              ? 'Try adjusting your search or filters.'
              : 'Create your first showcase to start building your portfolio.'}
          </p>
          {showcases.length === 0 && (
            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" />
              Create Showcase
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShowcases.map((showcase) => {
            const projectName = projectMap.get(showcase.projectId);
            const photoCount = showcase.galleryPhotoIds?.length || 0;
            const hasBeforeAfter = Boolean(showcase.beforePhotoId || showcase.afterPhotoId);
            const totalPhotos = photoCount + (showcase.beforePhotoId ? 1 : 0) + (showcase.afterPhotoId ? 1 : 0);
            const isToggling = togglingId === showcase.id;

            return (
              <Card key={showcase.id} className="overflow-hidden">
                {/* Card header / image placeholder */}
                <div className="relative h-36 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                  <Image className="h-10 w-10 text-slate-300" />
                  {/* Published badge */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                        showcase.isPublished
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {showcase.isPublished ? (
                        <>
                          <Eye className="h-2.5 w-2.5" />
                          Published
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-2.5 w-2.5" />
                          Draft
                        </>
                      )}
                    </span>
                  </div>
                  {/* Photo count */}
                  {totalPhotos > 0 && (
                    <div className="absolute bottom-3 left-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">
                        <Image className="h-2.5 w-2.5" />
                        {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>

                <CardContent className="p-4">
                  {/* Title and project */}
                  <h4 className="text-sm font-semibold text-slate-900 truncate">
                    {showcase.title}
                  </h4>
                  {projectName && (
                    <p className="text-xs text-blue-500 mt-0.5 truncate">{projectName}</p>
                  )}
                  {showcase.description && (
                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">
                      {showcase.description}
                    </p>
                  )}

                  {/* Meta tags */}
                  <div className="flex items-center gap-2 mt-3">
                    {hasBeforeAfter && (
                      <span className="inline-flex rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">
                        Before/After
                      </span>
                    )}
                    {showcase.slug && (
                      <span className="inline-flex rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 truncate max-w-[120px]">
                        /{showcase.slug}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                    <Button
                      variant={showcase.isPublished ? 'outline' : 'default'}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => handleTogglePublish(showcase)}
                      disabled={isToggling}
                    >
                      {isToggling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : showcase.isPublished ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Unpublish
                        </>
                      ) : (
                        <>
                          <Globe className="h-3.5 w-3.5" />
                          Publish
                        </>
                      )}
                    </Button>
                    <button
                      onClick={() => setDeleteTarget(showcase)}
                      className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete showcase"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <CreateShowcaseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
        projects={projects}
        companyId={profile?.companyId || ''}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteTarget !== null}
        showcaseTitle={deleteTarget?.title || ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
