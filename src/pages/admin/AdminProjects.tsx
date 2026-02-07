import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  FolderKanban,
  Search,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useProjects } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';
import type { ProjectStatus } from '@/types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const statusOptions: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'archived', label: 'Archived' },
];

const statusConfig: Record<ProjectStatus, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', classes: 'bg-emerald-100 text-emerald-700' },
  on_hold: { label: 'On Hold', classes: 'bg-amber-100 text-amber-700' },
  archived: { label: 'Archived', classes: 'bg-slate-100 text-slate-500' },
};

// ---------------------------------------------------------------------------
// Bulk Status Update Hook
// ---------------------------------------------------------------------------

function useBulkUpdateStatus() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ projectIds, status }: { projectIds: string[]; status: ProjectStatus }) => {
      if (!profile?.companyId || !user?.uid) throw new Error('Not authenticated');

      const updates = projectIds.map(async (id) => {
        const updateData: Record<string, unknown> = {
          status,
          updatedAt: serverTimestamp(),
        };
        if (status === 'completed') {
          updateData.completedAt = serverTimestamp();
        }
        if (status === 'archived') {
          updateData.archivedAt = serverTimestamp();
        }
        await updateDoc(doc(db, 'projects', id), updateData);
      });

      await Promise.all(updates);

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'project_updated',
        message: `${profile.fullName} bulk updated ${projectIds.length} projects to ${status}`,
        entityType: 'project',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

function useUpdateProjectStatus() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ projectId, status }: { projectId: string; status: ProjectStatus }) => {
      if (!profile?.companyId || !user?.uid) throw new Error('Not authenticated');

      const updateData: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };
      if (status === 'completed') {
        updateData.completedAt = serverTimestamp();
      }
      if (status === 'archived') {
        updateData.archivedAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'projects', projectId), updateData);

      await logActivity({
        companyId: profile.companyId,
        projectId,
        userId: user.uid,
        activityType: 'project_updated',
        message: `${profile.fullName} updated project status to ${status}`,
        entityType: 'project',
        entityId: projectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// ---------------------------------------------------------------------------
// AdminProjects Component
// ---------------------------------------------------------------------------

export default function AdminProjects() {
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ProjectStatus>('active');

  // Fetch all projects (including archived for admin)
  const statusFilter = filterStatus === 'all' ? undefined : filterStatus;
  const { data: projects = [], isLoading } = useProjects({
    status: statusFilter ?? 'active',
    search: searchQuery || undefined,
  });

  // For "all" we need to also fetch archived - use separate query
  const { data: allProjects = [], isLoading: allLoading } = useProjects(
    filterStatus === 'all' ? { status: undefined } : undefined,
  );

  const displayProjects = filterStatus === 'all' ? allProjects : projects;
  const loading = filterStatus === 'all' ? allLoading : isLoading;

  // Client-side search filter for allProjects mode
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return displayProjects;
    const q = searchQuery.toLowerCase();
    return displayProjects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.customerName?.toLowerCase().includes(q) ||
        p.addressFull?.toLowerCase().includes(q),
    );
  }, [displayProjects, searchQuery]);

  const bulkUpdate = useBulkUpdateStatus();
  const updateStatus = useUpdateProjectStatus();

  // Selection handlers
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProjects.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProjects.map((p) => p.id)));
    }
  };

  const handleBulkStatusChange = async () => {
    if (selectedIds.size === 0) return;
    await bulkUpdate.mutateAsync({ projectIds: Array.from(selectedIds), status: bulkStatus });
    setSelectedIds(new Set());
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="h-9 w-64 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ProjectStatus | 'all')}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
            <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as ProjectStatus)}
              className="h-8 rounded-md border border-blue-200 bg-white px-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
              <option value="archived">Archived</option>
            </select>
            <button
              onClick={handleBulkStatusChange}
              disabled={bulkUpdate.isPending}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {bulkUpdate.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Projects Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FolderKanban className="h-10 w-10 mb-2" />
            <p className="text-sm">No projects found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredProjects.length && filteredProjects.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                    />
                  </th>
                  <th className="py-3 px-4">Project Name</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Photos</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(project.id)}
                        onChange={() => toggleSelect(project.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <Link
                          to={`/projects/${project.id}`}
                          className="font-medium text-slate-900 hover:text-blue-600 transition-colors"
                        >
                          {project.name}
                        </Link>
                        {project.addressFull && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[250px]">
                            {project.addressFull}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={project.status}
                        onChange={(e) =>
                          updateStatus.mutate({
                            projectId: project.id,
                            status: e.target.value as ProjectStatus,
                          })
                        }
                        className={cn(
                          'h-7 rounded-lg border-0 text-xs font-medium px-2',
                          statusConfig[project.status].classes,
                        )}
                      >
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="on_hold">On Hold</option>
                        <option value="archived">Archived</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {project.customerName || '--'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {project.createdAt?.toDate?.()
                        ? project.createdAt.toDate().toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '--'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">--</td>
                    <td className="py-3 px-4">
                      <Link
                        to={`/projects/${project.id}`}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
