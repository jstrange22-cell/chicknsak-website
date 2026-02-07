import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  Plus,
  X,
  Loader2,
  LayoutTemplate,
  ListChecks,
  ToggleLeft,
  ToggleRight,
  CheckCircle2,
  Circle,
  Layers,
  Hash,
  Mic,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type {
  ChecklistTemplate,
  ChecklistCategory,
  Checklist,
  ChecklistStatus,
  TemplateSection,
  Project,
  User as UserType,
} from '@/types';

const VoiceNotesPage = lazy(() => import('@/pages/VoiceNotesPage'));

// ============================================================================
// Helpers
// ============================================================================

type Tab = 'templates' | 'checklists' | 'voice-notes';

const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  inspection: 'Inspection',
  installation: 'Installation',
  safety: 'Safety',
  quality: 'Quality',
  custom: 'Custom',
};

const CATEGORY_COLORS: Record<ChecklistCategory, string> = {
  inspection: 'bg-purple-100 text-purple-700',
  installation: 'bg-blue-100 text-blue-700',
  safety: 'bg-red-100 text-red-700',
  quality: 'bg-emerald-100 text-emerald-700',
  custom: 'bg-slate-100 text-slate-600',
};

const CHECKLIST_STATUS_COLORS: Record<ChecklistStatus, string> = {
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
};

function formatDate(ts: { toDate?: () => Date } | undefined): string {
  if (!ts || !ts.toDate) return '\u2014';
  return ts.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function countFields(sections: TemplateSection[]): number {
  return sections.reduce((sum, s) => sum + s.fields.length, 0);
}

function buildDefaultSection(): TemplateSection {
  return {
    name: 'General',
    fields: [
      {
        id: crypto.randomUUID(),
        label: 'Item 1',
        type: 'checkbox',
        required: false,
      },
    ],
  };
}

// ============================================================================
// Create Template Modal
// ============================================================================

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  companyId: string;
  userId: string;
}

function CreateTemplateModal({
  isOpen,
  onClose,
  onCreated,
  companyId,
  userId,
}: CreateTemplateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ChecklistCategory>('inspection');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('inspection');
    setError('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await addDoc(collection(db, 'checklistTemplates'), {
        companyId,
        name: name.trim(),
        description: description.trim() || '',
        category,
        sections: [buildDefaultSection()],
        createdBy: userId,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      resetForm();
      onCreated();
      onClose();
    } catch {
      setError('Failed to create template. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:mx-4 sm:max-w-lg rounded-t-xl sm:rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 sm:px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-slate-900">Create Template</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-5 sm:px-6 py-5">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Template Name
            </label>
            <Input
              placeholder="e.g. Pre-Installation Safety Check"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Description (optional)
            </label>
            <Input
              placeholder="Brief description of this template..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ChecklistCategory)}
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {(Object.keys(CATEGORY_LABELS) as ChecklistCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={!name.trim() || isSubmitting}
          >
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Start Checklist Modal
// ============================================================================

interface StartChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  templates: ChecklistTemplate[];
  projects: Project[];
  members: UserType[];
  companyId: string;
  userId: string;
}

function StartChecklistModal({
  isOpen,
  onClose,
  onCreated,
  templates,
  projects,
  members,
  companyId,
  userId,
}: StartChecklistModalProps) {
  const [templateId, setTemplateId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activeTemplates = templates.filter((t) => t.isActive);

  const resetForm = () => {
    setTemplateId('');
    setProjectId('');
    setAssignedTo('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!templateId) {
      setError('Please select a template.');
      return;
    }

    const selectedTemplate = templates.find((t) => t.id === templateId);
    if (!selectedTemplate) {
      setError('Template not found.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await addDoc(collection(db, 'checklists'), {
        companyId,
        projectId: projectId || '',
        templateId,
        name: selectedTemplate.name,
        status: 'in_progress' as ChecklistStatus,
        sections: selectedTemplate.sections,
        assignedTo: assignedTo || '',
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      resetForm();
      onCreated();
      onClose();
    } catch {
      setError('Failed to start checklist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:mx-4 sm:max-w-lg rounded-t-xl sm:rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 sm:px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-slate-900">Start Checklist</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-5 sm:px-6 py-5">
          {/* Template */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Template
            </label>
            {activeTemplates.length === 0 ? (
              <p className="text-sm text-slate-500">
                No active templates available. Create a template first.
              </p>
            ) : (
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <option value="">Select a template...</option>
                {activeTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Project (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Assign to Project (optional)
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assign to User (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Assign to User (optional)
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}{m.jobTitle ? ` — ${m.jobTitle}` : ''}
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={!templateId || isSubmitting}
          >
            <Plus className="h-4 w-4" />
            Start Checklist
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Templates Tab Content
// ============================================================================

interface TemplatesTabProps {
  templates: ChecklistTemplate[];
  isLoading: boolean;
  onToggleActive: (template: ChecklistTemplate) => void;
  togglingId: string | null;
  onOpenCreate: () => void;
}

function TemplatesTab({
  templates,
  isLoading,
  onToggleActive,
  togglingId,
  onOpenCreate,
}: TemplatesTabProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-20">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <LayoutTemplate className="h-7 w-7 text-slate-400" />
        </div>
        <h3 className="mb-1 text-base font-semibold text-slate-900">No templates yet</h3>
        <p className="max-w-[280px] text-center text-sm leading-relaxed text-slate-500">
          Create your first checklist template to get started.
        </p>
        <Button className="mt-4" onClick={onOpenCreate}>
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => {
        const fieldCount = countFields(template.sections);

        return (
          <div
            key={template.id}
            className="rounded-lg border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm"
          >
            {/* Top row: name + active toggle */}
            <div className="mb-3 flex items-start justify-between">
              <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                {template.name}
              </h3>
              <button
                onClick={() => onToggleActive(template)}
                disabled={togglingId === template.id}
                className="shrink-0 ml-2"
                title={template.isActive ? 'Deactivate template' : 'Activate template'}
              >
                {togglingId === template.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : template.isActive ? (
                  <ToggleRight className="h-6 w-6 text-emerald-500" />
                ) : (
                  <ToggleLeft className="h-6 w-6 text-slate-300" />
                )}
              </button>
            </div>

            {/* Description */}
            {template.description && (
              <p className="mb-3 text-xs text-slate-500 line-clamp-2">
                {template.description}
              </p>
            )}

            {/* Meta badges */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Category */}
              <span
                className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  CATEGORY_COLORS[template.category],
                )}
              >
                {CATEGORY_LABELS[template.category]}
              </span>

              {/* Section count */}
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Layers className="h-3 w-3" />
                {template.sections.length} section{template.sections.length !== 1 ? 's' : ''}
              </span>

              {/* Field count */}
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Hash className="h-3 w-3" />
                {fieldCount} field{fieldCount !== 1 ? 's' : ''}
              </span>

              {/* Active status */}
              <span
                className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  template.isActive
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500',
                )}
              >
                {template.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Checklists Tab Content
// ============================================================================

interface ChecklistsTabProps {
  checklists: Checklist[];
  isLoading: boolean;
  projectNameMap: Map<string, string>;
  memberNameMap: Map<string, string>;
  onMarkComplete: (checklist: Checklist) => void;
  completingId: string | null;
  onOpenStart: () => void;
}

function ChecklistsTab({
  checklists,
  isLoading,
  projectNameMap,
  memberNameMap,
  onMarkComplete,
  completingId,
  onOpenStart,
}: ChecklistsTabProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (checklists.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-20">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
          <ListChecks className="h-7 w-7 text-slate-400" />
        </div>
        <h3 className="mb-1 text-base font-semibold text-slate-900">No active checklists</h3>
        <p className="max-w-[280px] text-center text-sm leading-relaxed text-slate-500">
          Start a checklist from a template to begin tracking progress.
        </p>
        <Button className="mt-4" onClick={onOpenStart}>
          <Plus className="h-4 w-4" />
          Start Checklist
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {checklists.map((checklist) => {
        const totalFields = countFields(checklist.sections);
        const projectName = checklist.projectId
          ? projectNameMap.get(checklist.projectId) || '\u2014'
          : '\u2014';
        const isCompleted = checklist.status === 'completed';

        return (
          <div
            key={checklist.id}
            className="rounded-lg border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm"
          >
            {/* Top row: name + status */}
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                {checklist.name}
              </h3>
              <span
                className={cn(
                  'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                  CHECKLIST_STATUS_COLORS[checklist.status],
                )}
              >
                {checklist.status === 'in_progress' ? 'In Progress' : 'Completed'}
              </span>
            </div>

            {/* Meta */}
            <div className="mb-3 space-y-1">
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-600">Project:</span> {projectName}
              </p>
              {checklist.assignedTo && (
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-slate-600">Assigned to:</span>{' '}
                  {memberNameMap.get(checklist.assignedTo) || checklist.assignedTo}
                </p>
              )}
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-600">Created:</span>{' '}
                {formatDate(checklist.createdAt)}
              </p>
            </div>

            {/* Progress bar */}
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {totalFields} field{totalFields !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-medium text-slate-600">
                  {isCompleted ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Complete
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Circle className="h-3 w-3" />
                      In Progress
                    </span>
                  )}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    isCompleted ? 'bg-emerald-500' : 'bg-blue-500',
                  )}
                  style={{ width: isCompleted ? '100%' : '50%' }}
                />
              </div>
            </div>

            {/* Mark complete button */}
            {!isCompleted && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onMarkComplete(checklist)}
                disabled={completingId === checklist.id}
                isLoading={completingId === checklist.id}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark as Complete
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Checklists Page
// ============================================================================

export default function ChecklistsPage() {
  const { user, profile } = useAuthContext();

  const [activeTab, setActiveTab] = useState<Tab>('templates');
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<UserType[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingChecklists, setIsLoadingChecklists] = useState(true);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [showStartChecklistModal, setShowStartChecklistModal] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Fetch templates
  const fetchTemplates = async () => {
    if (!profile?.companyId) {
      setIsLoadingTemplates(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'checklistTemplates'),
        where('companyId', '==', profile.companyId),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ChecklistTemplate[];
      setTemplates(data);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Fetch checklists
  const fetchChecklists = async () => {
    if (!profile?.companyId) {
      setIsLoadingChecklists(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'checklists'),
        where('companyId', '==', profile.companyId),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Checklist[];
      data.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      setChecklists(data);
    } catch (err) {
      console.error('Failed to fetch checklists:', err);
    } finally {
      setIsLoadingChecklists(false);
    }
  };

  // Fetch projects
  const fetchProjects = async () => {
    if (!profile?.companyId) return;
    try {
      const q = query(
        collection(db, 'projects'),
        where('companyId', '==', profile.companyId),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Project[];
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  // Fetch company members
  const fetchMembers = async () => {
    if (!profile?.companyId) return;

    try {
      const q = query(
        collection(db, 'users'),
        where('companyId', '==', profile.companyId),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as UserType[];
      setMembers(data.filter((m) => m.isActive !== false));
    } catch (err) {
      console.error('Failed to fetch members:', err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchChecklists();
    fetchProjects();
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.companyId]);

  // Project name lookup
  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, p.name);
    }
    return map;
  }, [projects]);

  // Member name lookup
  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.id, m.fullName);
    }
    return map;
  }, [members]);

  // Toggle template active/inactive
  const handleToggleActive = async (template: ChecklistTemplate) => {
    setTogglingId(template.id);

    try {
      await updateDoc(doc(db, 'checklistTemplates', template.id), {
        isActive: !template.isActive,
        updatedAt: serverTimestamp(),
      });
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === template.id ? { ...t, isActive: !t.isActive } : t,
        ),
      );
    } catch (err) {
      console.error('Failed to toggle template status:', err);
    } finally {
      setTogglingId(null);
    }
  };

  // Mark checklist as completed
  const handleMarkComplete = async (checklist: Checklist) => {
    setCompletingId(checklist.id);

    try {
      await updateDoc(doc(db, 'checklists', checklist.id), {
        status: 'completed' as ChecklistStatus,
        completedAt: serverTimestamp(),
        completedBy: user?.uid || '',
        updatedAt: serverTimestamp(),
      });
      setChecklists((prev) =>
        prev.map((c) =>
          c.id === checklist.id ? { ...c, status: 'completed' as ChecklistStatus } : c,
        ),
      );
    } catch (err) {
      console.error('Failed to complete checklist:', err);
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col">
      {/* Page Header */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Checklists</h1>
          <p className="mt-1 text-sm text-slate-500 hidden sm:block">
            Build templates and track checklist progress across all projects.
          </p>
        </div>
        {activeTab === 'templates' ? (
          <Button className="w-full sm:w-auto shrink-0" onClick={() => setShowCreateTemplateModal(true)}>
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        ) : activeTab === 'checklists' ? (
          <Button className="w-full sm:w-auto shrink-0" onClick={() => setShowStartChecklistModal(true)}>
            <Plus className="h-4 w-4" />
            Start Checklist
          </Button>
        ) : null}
      </div>

      {/* Tab bar */}
      <div className="mb-4 md:mb-6 flex border-b border-slate-200 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('templates')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-3 md:px-4 pb-3 text-sm font-medium transition-colors shrink-0 min-h-[44px]',
            activeTab === 'templates'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
        >
          <LayoutTemplate className="h-4 w-4" />
          Templates
          <span
            className={cn(
              'inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium',
              activeTab === 'templates'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-slate-100 text-slate-500',
            )}
          >
            {templates.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('checklists')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-3 md:px-4 pb-3 text-sm font-medium transition-colors shrink-0 min-h-[44px]',
            activeTab === 'checklists'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
        >
          <ListChecks className="h-4 w-4" />
          <span className="hidden sm:inline">Active </span>Checklists
          <span
            className={cn(
              'inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium',
              activeTab === 'checklists'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-slate-100 text-slate-500',
            )}
          >
            {checklists.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('voice-notes')}
          className={cn(
            'flex items-center gap-1.5 border-b-2 px-3 md:px-4 pb-3 text-sm font-medium transition-colors shrink-0 min-h-[44px]',
            activeTab === 'voice-notes'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
        >
          <Mic className="h-4 w-4" />
          Voice Notes
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'templates' ? (
        <TemplatesTab
          templates={templates}
          isLoading={isLoadingTemplates}
          onToggleActive={handleToggleActive}
          togglingId={togglingId}
          onOpenCreate={() => setShowCreateTemplateModal(true)}
        />
      ) : activeTab === 'checklists' ? (
        <ChecklistsTab
          checklists={checklists}
          isLoading={isLoadingChecklists}
          projectNameMap={projectNameMap}
          memberNameMap={memberNameMap}
          onMarkComplete={handleMarkComplete}
          completingId={completingId}
          onOpenStart={() => setShowStartChecklistModal(true)}
        />
      ) : (
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        }>
          <VoiceNotesPage />
        </Suspense>
      )}

      {/* Modals */}
      <CreateTemplateModal
        isOpen={showCreateTemplateModal}
        onClose={() => setShowCreateTemplateModal(false)}
        onCreated={fetchTemplates}
        companyId={profile?.companyId || ''}
        userId={user?.uid || ''}
      />
      <StartChecklistModal
        isOpen={showStartChecklistModal}
        onClose={() => setShowStartChecklistModal(false)}
        onCreated={fetchChecklists}
        templates={templates}
        projects={projects}
        members={members}
        companyId={profile?.companyId || ''}
        userId={user?.uid || ''}
      />
    </div>
  );
}
