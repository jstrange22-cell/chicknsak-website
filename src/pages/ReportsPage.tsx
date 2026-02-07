import { useState, useEffect, useMemo } from 'react';
import {
  FileBarChart,
  Plus,
  X,
  Trash2,
  Loader2,
  Search,
  Eye,
  EyeOff,
  Filter,
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
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { Report, ReportType, ReportStatus, Project } from '@/types';

// ============================================================================
// Helpers
// ============================================================================

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  photo: 'Photo',
  inspection: 'Inspection',
  insurance: 'Insurance',
  progress: 'Progress',
  custom: 'Custom',
};

const REPORT_TYPE_COLORS: Record<ReportType, string> = {
  photo: 'bg-blue-100 text-blue-700',
  inspection: 'bg-purple-100 text-purple-700',
  insurance: 'bg-amber-100 text-amber-700',
  progress: 'bg-emerald-100 text-emerald-700',
  custom: 'bg-slate-100 text-slate-600',
};

const STATUS_COLORS: Record<ReportStatus, string> = {
  draft: 'bg-amber-100 text-amber-700',
  published: 'bg-emerald-100 text-emerald-700',
};

function formatDate(ts: { toDate?: () => Date } | undefined): string {
  if (!ts || !ts.toDate) return '\u2014';
  return ts.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================================
// Create Report Modal
// ============================================================================

interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  projects: Project[];
  companyId: string;
  userId: string;
}

function CreateReportModal({
  isOpen,
  onClose,
  onCreated,
  projects,
  companyId,
  userId,
}: CreateReportModalProps) {
  const [name, setName] = useState('');
  const [reportType, setReportType] = useState<ReportType>('photo');
  const [projectId, setProjectId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setName('');
    setReportType('photo');
    setProjectId('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Report name is required.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await addDoc(collection(db, 'reports'), {
        companyId,
        projectId: projectId || '',
        name: name.trim(),
        reportType,
        coverTitle: '',
        includeLogo: true,
        sections: [],
        pdfUrl: '',
        shareLink: '',
        shareToken: crypto.randomUUID(),
        status: 'draft' as ReportStatus,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      resetForm();
      onCreated();
      onClose();
    } catch {
      setError('Failed to create report. Please try again.');
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
          <h2 className="text-lg font-semibold text-slate-900">Create Report</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Report Name
            </label>
            <Input
              placeholder="e.g. Weekly Progress Report"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Report Type */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((type) => (
                <option key={type} value={type}>
                  {REPORT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          {/* Project (optional) */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Project (optional)
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
            Create Report
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Reports Page
// ============================================================================

export default function ReportsPage() {
  const { user, profile } = useAuthContext();

  const [reports, setReports] = useState<Report[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ReportType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch reports
  const fetchReports = async () => {
    if (!profile?.companyId) {
      setIsLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'reports'),
        where('companyId', '==', profile.companyId),
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Report[];
      // Sort client-side to avoid needing a Firestore composite index
      data.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      setReports(data);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch projects for the dropdown
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

  useEffect(() => {
    fetchReports();
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.companyId]);

  // Build a lookup map: projectId -> project name
  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) {
      map.set(p.id, p.name);
    }
    return map;
  }, [projects]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (typeFilter !== 'all' && r.reportType !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(q);
        const matchesProject = projectNameMap.get(r.projectId)?.toLowerCase().includes(q);
        if (!matchesName && !matchesProject) return false;
      }
      return true;
    });
  }, [reports, typeFilter, statusFilter, searchQuery, projectNameMap]);

  // Toggle status
  const handleToggleStatus = async (report: Report) => {
    setTogglingId(report.id);
    const newStatus: ReportStatus = report.status === 'draft' ? 'published' : 'draft';

    try {
      await updateDoc(doc(db, 'reports', report.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, status: newStatus } : r)),
      );
    } catch (err) {
      console.error('Failed to update report status:', err);
    } finally {
      setTogglingId(null);
    }
  };

  // Delete report
  const handleDelete = async (reportId: string) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;

    setDeletingId(reportId);
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch (err) {
      console.error('Failed to delete report:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
            {!isLoading && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {reports.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Analyze project performance and generate detailed reports.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          Create Report
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by report name or project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ReportType | 'all')}
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <option value="all">All Types</option>
            {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((type) => (
              <option key={type} value={type}>
                {REPORT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5">
          {(['all', 'draft', 'published'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Table */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <FileBarChart className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-slate-900">
            {reports.length > 0 ? 'No matching reports' : 'No reports yet'}
          </h3>
          <p className="max-w-[280px] text-center text-sm leading-relaxed text-slate-500">
            {reports.length > 0
              ? 'Try adjusting your search or filters.'
              : 'Create your first report to get started.'}
          </p>
          {reports.length === 0 && (
            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" />
              Create Report
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report) => {
                  const projectName = report.projectId
                    ? projectNameMap.get(report.projectId) || '\u2014'
                    : '\u2014';

                  return (
                    <tr key={report.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-900">
                          {report.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            REPORT_TYPE_COLORS[report.reportType],
                          )}
                        >
                          {REPORT_TYPE_LABELS[report.reportType]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            STATUS_COLORS[report.status],
                          )}
                        >
                          {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500">{projectName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500">
                          {formatDate(report.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Toggle publish/unpublish */}
                          <button
                            onClick={() => handleToggleStatus(report)}
                            disabled={togglingId === report.id}
                            className={cn(
                              'rounded-md p-1.5 transition-colors disabled:opacity-50',
                              report.status === 'draft'
                                ? 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                                : 'text-emerald-500 hover:bg-amber-50 hover:text-amber-600',
                            )}
                            title={
                              report.status === 'draft' ? 'Publish report' : 'Unpublish report'
                            }
                          >
                            {togglingId === report.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : report.status === 'draft' ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(report.id)}
                            disabled={deletingId === report.id}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            title="Delete report"
                          >
                            {deletingId === report.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Report Modal */}
      <CreateReportModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchReports}
        projects={projects}
        companyId={profile?.companyId || ''}
        userId={user?.uid || ''}
      />
    </div>
  );
}
