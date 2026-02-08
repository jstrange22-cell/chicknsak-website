import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  FileText,
  CheckSquare,
  ListTodo,
  FileBarChart,
  MapPin,
  Loader2,
  Plus,
  Share2,
  Copy,
  Check,
  Trash2,
  Star,
  MoreHorizontal,
  Tag,
  MessageCircle,
  Pencil,
  Users,
  Upload,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { useProject } from '@/hooks/useProjects';
import { usePhotos } from '@/hooks/usePhotos';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { PhotoGrid } from '@/components/photos/PhotoGrid';
import { uploadPhoto } from '@/lib/storage';

// Checklists
import {
  useProjectChecklists,
  useChecklist,
  useCreateChecklist,
  useUpdateChecklistItem,
  useCompleteChecklist,
} from '@/hooks/useChecklists';
import {
  useChecklistTemplates,
} from '@/hooks/useChecklistTemplates';
import ChecklistTemplateList from '@/components/checklists/ChecklistTemplateList';
import ChecklistRunner from '@/components/checklists/ChecklistRunner';

// Tasks
import {
  useProjectTasks,
  useCreateTask,
  useCompleteTask,
  useDeleteTask,
} from '@/hooks/useTasks';
import TaskCard from '@/components/tasks/TaskCard';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';

// Documents
import {
  useProjectDocuments,
  useUploadDocument,
  useDeleteDocument,
} from '@/hooks/useDocuments';
import DocumentUpload from '@/components/documents/DocumentUpload';

// Pages
import { useProjectPages, useCreatePage, useUpdatePage, useDeletePage } from '@/hooks/usePages';
import PagesList from '@/components/pages/PagesList';
import PageEditor from '@/components/pages/PageEditor';

// Reports
import { useProjectReports, useCreateReport, useUpdateReport, useDeleteReport, usePublishReport } from '@/hooks/useReports';
import ReportBuilder from '@/components/reports/ReportBuilder';
import ReportPreview from '@/components/reports/ReportPreview';

// Galleries
import { useProjectGalleries, useCreateGallery, useDeleteGallery } from '@/hooks/useGalleries';
import { GalleryBuilder } from '@/components/galleries/GalleryBuilder';

// Collaborators
import { useProjectCollaborators, useRemoveCollaborator } from '@/hooks/useCollaborators';
import { CollaboratorList } from '@/components/collaborators/CollaboratorList';
import { InviteCollaborator } from '@/components/collaborators/InviteCollaborator';

import type { ChecklistTemplate, TaskPriority, PageType, ReportType, Page, Report } from '@/types';

const tabs = [
  { id: 'photos', label: 'Photos' },
  { id: 'pages', label: 'Pages' },
  { id: 'documents', label: 'Files' },
  { id: 'checklists', label: 'Checklists' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'reports', label: 'Reports' },
  { id: 'timeline', label: 'Timeline' },
];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuthContext();
  const [activeTab, setActiveTab] = useState('photos');

  // Photo state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Checklist state
  const [showNewChecklist, setShowNewChecklist] = useState(false);
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);

  // Task state
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskFilter, setTaskFilter] = useState<string>('all');

  // Page state
  const [editingPage, setEditingPage] = useState<Page | null>(null);

  // Report state
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [previewingReport, setPreviewingReport] = useState<Report | null>(null);

  // Gallery state
  const [showGalleryBuilder, setShowGalleryBuilder] = useState(false);

  // Collaborator state
  const [showInviteCollaborator, setShowInviteCollaborator] = useState(false);

  // Share link copy state
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);

  // Project data
  const { data: project, isLoading, error } = useProject(id);

  // Checklists data & mutations
  const { data: checklists, isLoading: checklistsLoading } = useProjectChecklists(id);
  const { data: templates } = useChecklistTemplates();
  const { data: activeChecklistData } = useChecklist(activeChecklistId ?? undefined);
  const createChecklist = useCreateChecklist();
  const updateChecklistItem = useUpdateChecklistItem();
  const completeChecklist = useCompleteChecklist();

  // Tasks data & mutations
  const { data: tasks, isLoading: tasksLoading } = useProjectTasks(id);
  const createTask = useCreateTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();

  // Photos data
  const { data: photos, isLoading: photosLoading } = usePhotos({ projectId: id });

  // Documents data & mutations
  const { data: documents, isLoading: documentsLoading } = useProjectDocuments(id);
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();

  // Pages data & mutations
  const { data: pages, isLoading: pagesLoading } = useProjectPages(id);
  const createPage = useCreatePage();
  const updatePage = useUpdatePage();
  const deletePage = useDeletePage();

  // Reports data & mutations
  const { data: reports, isLoading: reportsLoading } = useProjectReports(id);
  const createReport = useCreateReport();
  const updateReport = useUpdateReport();
  const deleteReport = useDeleteReport();
  const publishReport = usePublishReport();

  // Galleries data & mutations
  const { data: galleries, isLoading: galleriesLoading } = useProjectGalleries(id);
  const createGallery = useCreateGallery();
  const deleteGallery = useDeleteGallery();

  // Collaborators data & mutations
  const { data: collaborators, isLoading: collaboratorsLoading } = useProjectCollaborators(id);
  const removeCollaborator = useRemoveCollaborator();

  // Handlers
  const handleCreateFromTemplate = (template: ChecklistTemplate) => {
    if (!id) return;
    createChecklist.mutate(
      {
        projectId: id,
        name: template.name,
        templateId: template.id,
        sections: template.sections,
      },
      {
        onSuccess: () => {
          setShowNewChecklist(false);
        },
      }
    );
  };

  const handleCreateBlank = () => {
    if (!id) return;
    createChecklist.mutate(
      {
        projectId: id,
        name: 'Untitled Checklist',
        sections: [{ name: 'General', fields: [{ id: crypto.randomUUID(), label: 'Item 1', type: 'checkbox', required: false }] }],
      },
      {
        onSuccess: () => {
          setShowNewChecklist(false);
        },
      }
    );
  };

  const filteredTasks = (tasks ?? []).filter((t) => {
    if (taskFilter === 'all') return true;
    return t.status === taskFilter;
  });

  const handleCopyShareLink = (type: string, token: string) => {
    const url = `${window.location.origin}/share/${type}/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedShareId(token);
    setTimeout(() => setCopiedShareId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-4">
        <p className="text-slate-500 mb-4">Project not found</p>
        <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
      </div>
    );
  }

  // If checklist runner is active, show it full-screen
  if (activeChecklistId && activeChecklistData) {
    return (
      <ChecklistRunner
        checklist={{
          id: activeChecklistData.checklist.id,
          name: activeChecklistData.checklist.name,
          status: activeChecklistData.checklist.status,
          projectId: activeChecklistData.checklist.projectId,
        }}
        items={activeChecklistData.items}
        onUpdateItem={(itemId, updates) => {
          updateChecklistItem.mutate({ itemId, updates });
        }}
        onComplete={() => {
          completeChecklist.mutate(
            { checklistId: activeChecklistId },
            { onSuccess: () => setActiveChecklistId(null) }
          );
        }}
        onBack={() => setActiveChecklistId(null)}
        projectName={project.name}
        isCompleting={completeChecklist.isPending}
      />
    );
  }

  // If editing a page, show the PageEditor full-screen
  if (editingPage) {
    return (
      <PageEditor
        page={editingPage}
        onSave={(data) => {
          updatePage.mutate({ id: editingPage.id, data });
        }}
        onBack={() => setEditingPage(null)}
        isSaving={updatePage.isPending}
        projectName={project.name}
      />
    );
  }

  // If editing a report, show ReportBuilder full-screen
  if (editingReport) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <ReportBuilder
          initialName={editingReport.name}
          initialCoverTitle={editingReport.coverTitle}
          initialReportType={editingReport.reportType}
          initialIncludeLogo={editingReport.includeLogo}
          initialSections={editingReport.sections}
          projectPhotos={[]} // TODO: wire up project photos when photo system is complete
          onSave={(data) => {
            updateReport.mutate(
              { id: editingReport.id, data },
              { onSuccess: () => setEditingReport(null) }
            );
          }}
          onPublish={() => {
            publishReport.mutate({ reportId: editingReport.id });
          }}
          onCancel={() => setEditingReport(null)}
          isSaving={updateReport.isPending}
        />
      </div>
    );
  }

  // If previewing a report, show ReportPreview full-screen
  if (previewingReport) {
    return (
      <div className="min-h-screen bg-slate-100 p-4">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="outline" onClick={() => setPreviewingReport(null)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h2 className="text-lg font-semibold text-slate-900">Report Preview</h2>
          {previewingReport.shareToken && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyShareLink('report', previewingReport.shareToken)}
            >
              {copiedShareId === previewingReport.shareToken ? (
                <><Check className="h-4 w-4" /> Copied</>
              ) : (
                <><Share2 className="h-4 w-4" /> Share Link</>
              )}
            </Button>
          )}
        </div>
        <ReportPreview
          reportName={previewingReport.name}
          coverTitle={previewingReport.coverTitle}
          sections={previewingReport.sections}
          photos={{}}
          projectName={project.name}
        />
      </div>
    );
  }

  // Compute tab counts
  const tabCounts: Record<string, number> = {
    photos: (photos ?? []).length,
    pages: (pages ?? []).length,
    documents: (documents ?? []).length,
    checklists: (checklists ?? []).length,
    tasks: (tasks ?? []).length,
    reports: (reports ?? []).length,
    timeline: 0,
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header */}
      <div className="border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto px-4 md:px-6">
          {/* Breadcrumb */}
          <div className="pt-4 pb-2">
            <button
              onClick={() => navigate('/projects')}
              className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Projects
            </button>
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2 pb-3">
            <button className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-amber-500 transition-colors" title="Star project">
              <Star className="h-5 w-5" />
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-slate-600 hover:bg-slate-100 transition-colors">
              <Share2 className="h-4 w-4" />
              Share
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-slate-600 hover:bg-slate-100 transition-colors">
              Showcase This Project
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm text-slate-600 hover:bg-slate-100 transition-colors">
              Request Review
            </button>
            <button className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors" title="More options">
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {/* Status Badge */}
            <span
              className={cn(
                'ml-auto px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide',
                project.status === 'active' && 'bg-emerald-100 text-emerald-700',
                project.status === 'completed' && 'bg-blue-100 text-blue-700',
                project.status === 'on_hold' && 'bg-amber-100 text-amber-700',
                project.status === 'archived' && 'bg-slate-100 text-slate-600'
              )}
            >
              {project.status}
            </span>
          </div>

          {/* Project Name & Address */}
          <div className="pb-4">
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            {project.addressFull && (
              <p className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                <MapPin className="h-3.5 w-3.5" />
                {project.addressCity && project.addressState
                  ? `${project.addressCity}, ${project.addressState}`
                  : project.addressFull}
              </p>
            )}
            <button className="inline-flex items-center gap-1.5 mt-2 text-sm text-blue-600 hover:text-blue-700 transition-colors">
              <Tag className="h-3.5 w-3.5" />
              Add Labels
            </button>
          </div>
        </div>
      </div>

      {/* Two-column Layout */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-6 py-0">
        <div className="flex flex-col lg:flex-row gap-0">
          {/* Left Content Area */}
          <div className="flex-1 min-w-0">
            {/* Tab Navigation - underline style */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200">
              <div className="flex overflow-x-auto scrollbar-hide gap-0">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'px-4 py-3 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px',
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600 font-semibold'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {tab.label} ({tabCounts[tab.id] ?? 0})
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="py-6 pr-0 lg:pr-6">
              {/* PHOTOS TAB */}
              {activeTab === 'photos' && (
                <div>
                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <Button
                      onClick={() => navigate(`/camera?projectId=${id}`)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Camera className="h-4 w-4" />
                      Take Photo
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <Upload className="h-4 w-4" />
                      {isUploading ? uploadProgress : 'Upload from Gallery'}
                    </Button>
                    {/* Hidden file input for gallery upload */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files?.length || !id || !user?.uid || !profile?.companyId) return;
                        setIsUploading(true);
                        try {
                          for (let i = 0; i < files.length; i++) {
                            setUploadProgress(`Uploading ${i + 1}/${files.length}...`);
                            await uploadPhoto({
                              file: files[i],
                              projectId: id,
                              userId: user.uid,
                              companyId: profile.companyId,
                            });
                          }
                          setUploadProgress('');
                          // Reset input so same file can be re-selected
                          e.target.value = '';
                        } catch (err) {
                          console.error('Upload failed:', err);
                        } finally {
                          setIsUploading(false);
                        }
                      }}
                    />
                  </div>

                  {/* Photo grid or empty state */}
                  {photosLoading ? (
                    <PhotoGrid photos={[]} isLoading />
                  ) : photos && photos.length > 0 ? (
                    <PhotoGrid photos={photos} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                        <Camera className="h-7 w-7 text-slate-400" />
                      </div>
                      <h3 className="text-base font-semibold text-slate-900 mb-1">No photos yet</h3>
                      <p className="text-sm text-slate-500 mb-5 text-center max-w-[280px]">
                        Take a photo with your camera or upload from your gallery to get started.
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => navigate(`/camera?projectId=${id}`)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Camera className="h-4 w-4" />
                          Take Photo
                        </Button>
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                          <ImageIcon className="h-4 w-4" />
                          Upload
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TIMELINE TAB */}
              {activeTab === 'timeline' && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Clock className="h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm">No activity yet</p>
                  <p className="text-slate-400 text-xs mt-1">Activity will appear here as work progresses</p>
                </div>
              )}

              {/* CHECKLISTS TAB */}
              {activeTab === 'checklists' && (
                <div className="space-y-4">
                  {showNewChecklist ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">
                          New Checklist
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNewChecklist(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleCreateBlank}
                        className="w-full justify-start"
                        isLoading={createChecklist.isPending}
                      >
                        <Plus className="h-4 w-4" />
                        Blank Checklist
                      </Button>
                      <ChecklistTemplateList
                        templates={templates ?? []}
                        isLoading={false}
                        onCreateNew={() => {}}
                        onEdit={() => {}}
                        onDelete={() => {}}
                        onSelect={handleCreateFromTemplate}
                        selectable
                      />
                    </div>
                  ) : (
                    <>
                      {checklistsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        </div>
                      ) : (checklists ?? []).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20">
                          <CheckSquare className="h-10 w-10 text-slate-300 mb-3" />
                          <p className="font-semibold text-slate-700 mb-1">Don't Drop the Ball</p>
                          <p className="text-slate-400 text-sm mb-4">Create checklists to track work on this project</p>
                          <Button onClick={() => setShowNewChecklist(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                            <Plus className="h-4 w-4" />
                            Create Checklist
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-end">
                            <Button
                              size="sm"
                              onClick={() => setShowNewChecklist(true)}
                            >
                              <Plus className="h-4 w-4" />
                              New
                            </Button>
                          </div>
                          {(checklists ?? []).map((checklist) => {
                            const percent =
                              checklist.totalItems > 0
                                ? Math.round(
                                    (checklist.completedItems /
                                      checklist.totalItems) *
                                      100
                                  )
                                : 0;

                            return (
                              <button
                                key={checklist.id}
                                onClick={() =>
                                  setActiveChecklistId(checklist.id)
                                }
                                className="w-full bg-white rounded-lg border border-slate-200 p-4 text-left hover:border-blue-300 transition-colors"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-semibold text-slate-900">
                                    {checklist.name}
                                  </h4>
                                  <span
                                    className={cn(
                                      'px-2 py-0.5 rounded-full text-xs font-medium',
                                      checklist.status === 'completed'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-blue-100 text-blue-700'
                                    )}
                                  >
                                    {checklist.status === 'completed'
                                      ? 'Completed'
                                      : `${percent}%`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                      className={cn(
                                        'h-full rounded-full transition-all duration-300',
                                        percent === 100
                                          ? 'bg-emerald-500'
                                          : 'bg-blue-500'
                                      )}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-slate-400 shrink-0">
                                    {checklist.completedItems}/
                                    {checklist.totalItems}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TASKS TAB */}
              {activeTab === 'tasks' && (
                <div className="space-y-4">
                  {/* Status Filter */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {['all', 'pending', 'in_progress', 'completed'].map(
                        (status) => (
                          <button
                            key={status}
                            onClick={() => setTaskFilter(status)}
                            className={cn(
                              'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                              taskFilter === status
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-slate-500 hover:bg-slate-100'
                            )}
                          >
                            {status === 'all'
                              ? 'All'
                              : status === 'in_progress'
                                ? 'In Progress'
                                : status.charAt(0).toUpperCase() + status.slice(1)}
                          </button>
                        )
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowCreateTask(true)}
                    >
                      <Plus className="h-4 w-4" />
                      New Task
                    </Button>
                  </div>

                  {tasksLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                  ) : filteredTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <ListTodo className="h-10 w-10 text-slate-300 mb-3" />
                      <p className="text-slate-500 text-sm mb-4">No tasks yet. Create tasks to track work on this project.</p>
                      <Button onClick={() => setShowCreateTask(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="h-4 w-4" />
                        Create Task
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={(taskId) =>
                            completeTask.mutate({ taskId })
                          }
                          onDelete={(taskId) =>
                            deleteTask.mutate(taskId)
                          }
                        />
                      ))}
                    </div>
                  )}

                  <CreateTaskModal
                    isOpen={showCreateTask}
                    onClose={() => setShowCreateTask(false)}
                    onSubmit={(data) => {
                      if (!id) return;
                      createTask.mutate(
                        {
                          projectId: id,
                          title: data.title,
                          description: data.description,
                          assignedTo: data.assignedTo,
                          priority: data.priority as TaskPriority,
                          dueDate: data.dueDate,
                          photoId: data.photoId,
                        },
                        {
                          onSuccess: () => setShowCreateTask(false),
                        }
                      );
                    }}
                    isSubmitting={createTask.isPending}
                    projectId={id || ''}
                  />
                </div>
              )}

              {/* DOCUMENTS (FILES) TAB */}
              {activeTab === 'documents' && (
                <div className="space-y-4">
                  {documentsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <DocumentUpload
                      documents={documents ?? []}
                      onUpload={(file, description) => {
                        if (!id) return;
                        uploadDocument.mutate({
                          projectId: id,
                          file,
                          description,
                        });
                      }}
                      onDelete={(doc) => {
                        deleteDocument.mutate({
                          documentId: doc.id,
                          storagePath: doc.storagePath,
                          projectId: doc.projectId,
                        });
                      }}
                      isUploading={uploadDocument.isPending}
                    />
                  )}
                </div>
              )}

              {/* PAGES TAB */}
              {activeTab === 'pages' && (
                <div>
                  {pagesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <PagesList
                      pages={pages ?? []}
                      isLoading={pagesLoading}
                      onCreatePage={(pageType: PageType) => {
                        if (!id) return;
                        createPage.mutate(
                          { projectId: id, title: 'Untitled', pageType },
                          {
                            onSuccess: (newPage) => {
                              setEditingPage(newPage as unknown as Page);
                            },
                          }
                        );
                      }}
                      onSelectPage={(pageId: string) => {
                        const page = (pages ?? []).find((p) => p.id === pageId);
                        if (page) setEditingPage(page);
                      }}
                      onDeletePage={(pageId: string) => {
                        deletePage.mutate(pageId);
                      }}
                    />
                  )}
                </div>
              )}

              {/* REPORTS TAB */}
              {activeTab === 'reports' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!id) return;
                        createReport.mutate(
                          {
                            projectId: id,
                            name: 'New Report',
                            reportType: 'photo' as ReportType,
                          },
                          {
                            onSuccess: (newReport) => {
                              setEditingReport(newReport as unknown as Report);
                            },
                          }
                        );
                      }}
                      isLoading={createReport.isPending}
                    >
                      <Plus className="h-4 w-4" />
                      New Report
                    </Button>
                  </div>

                  {reportsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                  ) : (reports ?? []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <FileBarChart className="h-10 w-10 text-slate-300 mb-3" />
                      <p className="text-slate-500 text-sm mb-4">Create photo reports to share with clients</p>
                      <Button
                        onClick={() => {
                          if (!id) return;
                          createReport.mutate(
                            {
                              projectId: id,
                              name: 'New Report',
                              reportType: 'photo' as ReportType,
                            },
                            {
                              onSuccess: (newReport) => {
                                setEditingReport(newReport as unknown as Report);
                              },
                            }
                          );
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        isLoading={createReport.isPending}
                      >
                        <Plus className="h-4 w-4" />
                        Create Report
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(reports ?? []).map((report) => (
                        <Card key={report.id} className="overflow-hidden">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-slate-900 truncate">
                                  {report.name}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={cn(
                                    'px-2 py-0.5 rounded-full text-xs font-medium',
                                    report.status === 'published'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : 'bg-amber-100 text-amber-700'
                                  )}>
                                    {report.status === 'published' ? 'Published' : 'Draft'}
                                  </span>
                                  <span className="text-xs text-slate-400 capitalize">
                                    {report.reportType.replace('_', ' ')}
                                  </span>
                                  <span className="text-xs text-slate-400">
                                    {report.sections.length} section{report.sections.length !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => setPreviewingReport(report)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                  title="Preview"
                                >
                                  <FileBarChart className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setEditingReport(report)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                                  title="Edit"
                                >
                                  <FileText className="h-4 w-4" />
                                </button>
                                {report.status === 'published' && (
                                  <button
                                    onClick={() => handleCopyShareLink('report', report.shareToken)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50"
                                    title="Copy share link"
                                  >
                                    {copiedShareId === report.shareToken ? (
                                      <Check className="h-4 w-4 text-emerald-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteReport.mutate(report.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-200">
            <div className="lg:sticky lg:top-0 divide-y divide-slate-200">
              {/* Contact Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Contact Info</h3>
                  <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {(project.customerName || project.customerEmail || project.customerPhone) ? (
                  <div className="space-y-1">
                    {project.customerName && (
                      <p className="text-sm text-slate-700">{project.customerName}</p>
                    )}
                    {project.customerEmail && (
                      <a href={`mailto:${project.customerEmail}`} className="text-sm text-blue-600 hover:underline block">
                        {project.customerEmail}
                      </a>
                    )}
                    {project.customerPhone && (
                      <a href={`tel:${project.customerPhone}`} className="text-sm text-blue-600 hover:underline block">
                        {project.customerPhone}
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No contact info added</p>
                )}
              </div>

              {/* Project Users */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Project Users ({(collaborators ?? []).length + 1})
                  </h3>
                  <button
                    onClick={() => setShowInviteCollaborator(true)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                    You
                  </div>
                  {(collaborators ?? []).slice(0, 4).map((collab) => (
                    <div
                      key={collab.id}
                      className="h-7 w-7 rounded-full bg-slate-300 flex items-center justify-center text-white text-xs font-medium"
                      title={collab.email}
                    >
                      {collab.email?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  ))}
                  {(collaborators ?? []).length > 4 && (
                    <span className="text-xs text-slate-400">+{(collaborators ?? []).length - 4}</span>
                  )}
                </div>
              </div>

              {/* Collaborators */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Collaborators</h3>
                  <button
                    onClick={() => setShowInviteCollaborator(true)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {collaboratorsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : (collaborators ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400">No collaborators</p>
                ) : (
                  <CollaboratorList
                    collaborators={collaborators ?? []}
                    isLoading={collaboratorsLoading}
                    onRemove={(collabId: string) => removeCollaborator.mutate(collabId)}
                    onInvite={() => setShowInviteCollaborator(true)}
                  />
                )}
              </div>

              {/* Description */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Description</h3>
                  <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-400">No description added</p>
              </div>

              {/* Address */}
              {project.addressFull && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Address</h3>
                  <p className="text-sm text-slate-600">{project.addressFull}</p>
                  {project.latitude && project.longitude && (
                    <a
                      href={`https://maps.google.com/?q=${project.latitude},${project.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      Open in Maps
                    </a>
                  )}
                </div>
              )}

              {/* Project Details */}
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Details</h3>
                <div className="space-y-1.5 text-sm">
                  {project.projectType && (
                    <div className="flex justify-between">
                      <span className="text-slate-400 text-xs">Type</span>
                      <span className="text-slate-700 text-xs capitalize">{project.projectType.replace('_', ' ')}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400 text-xs">Status</span>
                    <span className="text-slate-700 text-xs capitalize">{project.status}</span>
                  </div>
                </div>
              </div>

              {/* Tasks (sidebar) */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Tasks</h3>
                </div>
                <button
                  onClick={() => { setActiveTab('tasks'); setShowCreateTask(true); }}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Task
                </button>
                {(tasks ?? []).length > 0 && (
                  <p className="text-xs text-slate-400 mt-1">{(tasks ?? []).length} task{(tasks ?? []).length !== 1 ? 's' : ''}</p>
                )}
              </div>

              {/* Galleries */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-900">Galleries</h3>
                  <button
                    onClick={() => setShowGalleryBuilder(true)}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {galleriesLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : (galleries ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400">No galleries yet</p>
                ) : (
                  <div className="space-y-2">
                    {(galleries ?? []).map((gallery) => (
                      <div
                        key={gallery.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-700 truncate">{gallery.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleCopyShareLink('gallery', gallery.shareToken)}
                            className="p-1 rounded text-slate-400 hover:text-blue-500"
                            title="Copy share link"
                          >
                            {copiedShareId === gallery.shareToken ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Share2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteGallery.mutate(gallery.id)}
                            className="p-1 rounded text-slate-400 hover:text-red-500"
                            title="Delete gallery"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Project Conversation */}
              <div className="p-4">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Project Conversation</h3>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="border border-slate-200 rounded-lg">
                      <textarea
                        placeholder="Add a comment..."
                        className="w-full px-3 py-2 text-sm text-slate-700 placeholder-slate-400 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                        rows={2}
                      />
                      <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-100">
                        <button className="text-slate-400 hover:text-slate-600">
                          <MessageCircle className="h-4 w-4" />
                        </button>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 h-7">
                          Post
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Builder Modal */}
      <GalleryBuilder
        isOpen={showGalleryBuilder}
        onClose={() => setShowGalleryBuilder(false)}
        onSubmit={(data) => {
          if (!id) return;
          createGallery.mutate(
            { projectId: id, ...data },
            { onSuccess: () => setShowGalleryBuilder(false) }
          );
        }}
        isSubmitting={createGallery.isPending}
        projectPhotos={[]} // TODO: wire up project photos when photo system is complete
      />

      {/* Invite Collaborator Modal */}
      <InviteCollaborator
        isOpen={showInviteCollaborator}
        onClose={() => setShowInviteCollaborator(false)}
        projectId={id || ''}
      />
    </div>
  );
}
