import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Trash2,
  Edit3,
  FolderOpen,
  ClipboardCheck,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import {
  useProjectTemplates,
  useCreateProjectTemplate,
  useUpdateProjectTemplate,
  useDeleteProjectTemplate,
  useReportTemplates,
  useCreateReportTemplate,
  useDeleteReportTemplate,
} from '@/hooks/useTemplates';
import {
  useChecklistTemplates,
  useCreateTemplate as useCreateChecklistTemplate,
  useUpdateTemplate as useUpdateChecklistTemplate,
  useDeleteTemplate as useDeleteChecklistTemplate,
} from '@/hooks/useChecklistTemplates';
import type {
  ProjectType,
  ChecklistCategory,
  ChecklistFieldType,
  ReportType,
  ReportLayout,
  ProjectTemplate,
  ChecklistTemplate,
  ReportTemplate,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TemplateTab = 'project' | 'checklist' | 'report';

const TABS: { id: TemplateTab; label: string; icon: React.ElementType }[] = [
  { id: 'project', label: 'Project Templates', icon: FolderOpen },
  { id: 'checklist', label: 'Checklist Templates', icon: ClipboardCheck },
  { id: 'report', label: 'Report Templates', icon: FileText },
];

const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'deck', label: 'Deck' },
  { value: 'remodel', label: 'Remodel' },
  { value: 'new_construction', label: 'New Construction' },
  { value: 'repair', label: 'Repair' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'other', label: 'Other' },
];

const CHECKLIST_CATEGORIES: { value: ChecklistCategory; label: string }[] = [
  { value: 'inspection', label: 'Inspection' },
  { value: 'installation', label: 'Installation' },
  { value: 'safety', label: 'Safety' },
  { value: 'quality', label: 'Quality' },
  { value: 'custom', label: 'Custom' },
];

const FIELD_TYPES: { value: ChecklistFieldType; label: string }[] = [
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'photo_required', label: 'Photo Required' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'rating', label: 'Rating' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'text', label: 'Text' },
  { value: 'signature', label: 'Signature' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
];

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'photo', label: 'Photo Report' },
  { value: 'inspection', label: 'Inspection Report' },
  { value: 'insurance', label: 'Insurance Report' },
  { value: 'progress', label: 'Progress Report' },
  { value: 'custom', label: 'Custom Report' },
];

const REPORT_LAYOUTS: { value: ReportLayout; label: string }[] = [
  { value: 'grid', label: 'Grid' },
  { value: 'single', label: 'Single' },
  { value: 'side-by-side', label: 'Side by Side' },
];

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const projectTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  defaultProjectType: z.string().optional(),
  addressState: z.string().optional(),
});

type ProjectTemplateForm = z.infer<typeof projectTemplateSchema>;

const checklistFieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1, 'Label is required'),
  type: z.string() as z.ZodType<ChecklistFieldType>,
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

const checklistSectionSchema = z.object({
  name: z.string().min(1, 'Section name is required'),
  fields: z.array(checklistFieldSchema).min(1, 'At least one field is required'),
});

const checklistTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  category: z.string() as z.ZodType<ChecklistCategory>,
  sections: z.array(checklistSectionSchema).min(1, 'At least one section is required'),
});

type ChecklistTemplateForm = z.infer<typeof checklistTemplateSchema>;

const reportSectionSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Title is required'),
  notes: z.string().optional(),
  layout: z.string() as z.ZodType<ReportLayout>,
});

const reportTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  reportType: z.string() as z.ZodType<ReportType>,
  sections: z.array(reportSectionSchema),
});

type ReportTemplateForm = z.infer<typeof reportTemplateSchema>;

// ---------------------------------------------------------------------------
// Shared empty state
// ---------------------------------------------------------------------------

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-16">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs text-center">{description}</p>
    </div>
  );
}

// ============================================================
// PROJECT TEMPLATES TAB
// ============================================================

function ProjectTemplatesTab() {
  const { data: templates, isLoading } = useProjectTemplates();
  const createMutation = useCreateProjectTemplate();
  const updateMutation = useUpdateProjectTemplate();
  const deleteMutation = useDeleteProjectTemplate();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectTemplateForm>({
    resolver: zodResolver(projectTemplateSchema),
  });

  const startEdit = (template: ProjectTemplate) => {
    setEditingId(template.id);
    setShowForm(true);
    reset({
      name: template.name,
      description: template.description ?? '',
      defaultProjectType: template.defaultProjectType ?? '',
      addressState: template.defaultFields?.addressState ?? '',
    });
  };

  const startCreate = () => {
    setEditingId(null);
    setShowForm(true);
    reset({ name: '', description: '', defaultProjectType: '', addressState: '' });
  };

  const onSubmit = async (data: ProjectTemplateForm) => {
    const payload = {
      name: data.name,
      description: data.description || undefined,
      defaultProjectType: (data.defaultProjectType || undefined) as ProjectType | undefined,
      defaultFields: {
        addressState: data.addressState || undefined,
        projectType: (data.defaultProjectType || undefined) as ProjectType | undefined,
      },
    };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }

    setShowForm(false);
    setEditingId(null);
    reset();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Save default settings for new projects.
        </p>
        <Button size="sm" onClick={startCreate}>
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Create / edit form */}
      {showForm && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingId ? 'Edit Template' : 'New Project Template'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }}>
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g., Standard Deck Project"
                  error={errors.name?.message}
                  {...register('name')}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <Input
                  placeholder="Optional description..."
                  {...register('description')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Default Project Type</label>
                  <select
                    className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('defaultProjectType')}
                  >
                    <option value="">None</option>
                    {PROJECT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Default State</label>
                  <Input
                    placeholder="e.g., CA"
                    {...register('addressState')}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? 'Save Changes' : 'Create Template'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Template list */}
      {templates && templates.length > 0 ? (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                  <FolderOpen className="h-5 w-5 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-slate-900">{t.name}</h4>
                  <p className="text-xs text-slate-500 truncate">
                    {t.description || 'No description'}
                    {t.defaultProjectType && ` \u00B7 ${t.defaultProjectType}`}
                  </p>
                  {t.createdAt && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      Created {formatDate(t.createdAt.toDate())}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(t)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !showForm ? (
        <EmptyState
          icon={FolderOpen}
          title="No project templates yet"
          description="Create a template to save default settings and quickly start new projects."
        />
      ) : null}
    </div>
  );
}

// ============================================================
// CHECKLIST TEMPLATES TAB
// ============================================================

function ChecklistTemplatesTab() {
  const { data: templates, isLoading } = useChecklistTemplates();
  const createMutation = useCreateChecklistTemplate();
  const updateMutation = useUpdateChecklistTemplate();
  const deleteMutation = useDeleteChecklistTemplate();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ChecklistTemplateForm>({
    resolver: zodResolver(checklistTemplateSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'custom',
      sections: [
        {
          name: '',
          fields: [
            { id: crypto.randomUUID(), label: '', type: 'checkbox', required: false },
          ],
        },
      ],
    },
  });

  const {
    fields: sectionFields,
    append: appendSection,
    remove: removeSection,
  } = useFieldArray({ control, name: 'sections' });

  const startCreate = () => {
    setEditingId(null);
    setShowForm(true);
    reset({
      name: '',
      description: '',
      category: 'custom',
      sections: [
        {
          name: '',
          fields: [
            { id: crypto.randomUUID(), label: '', type: 'checkbox', required: false },
          ],
        },
      ],
    });
  };

  const startEdit = (template: ChecklistTemplate) => {
    setEditingId(template.id);
    setShowForm(true);
    reset({
      name: template.name,
      description: template.description ?? '',
      category: template.category,
      sections: template.sections.map((s) => ({
        name: s.name,
        fields: s.fields.map((f) => ({
          id: f.id,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options,
        })),
      })),
    });
  };

  const onSubmit = async (data: ChecklistTemplateForm) => {
    const payload = {
      name: data.name,
      description: data.description || undefined,
      category: data.category,
      sections: data.sections.map((s) => ({
        name: s.name,
        fields: s.fields.map((f) => ({
          id: f.id,
          label: f.label,
          type: f.type,
          required: f.required,
          ...(f.options ? { options: f.options } : {}),
        })),
      })),
    };

    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }

    setShowForm(false);
    setEditingId(null);
    reset();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Build reusable checklists for inspections, safety, and quality.
        </p>
        <Button size="sm" onClick={startCreate}>
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Create / edit form */}
      {showForm && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingId ? 'Edit Checklist Template' : 'New Checklist Template'}
              </h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); }}>
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g., Daily Safety Check"
                    error={errors.name?.message}
                    {...register('name')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Category</label>
                  <select
                    className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('category')}
                  >
                    {CHECKLIST_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Description</label>
                <Input
                  placeholder="Optional description..."
                  {...register('description')}
                />
              </div>

              {/* Sections */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-800">Sections</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendSection({
                        name: '',
                        fields: [
                          { id: crypto.randomUUID(), label: '', type: 'checkbox', required: false },
                        ],
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Section
                  </Button>
                </div>

                {sectionFields.map((section, sIdx) => (
                  <SectionEditor
                    key={section.id}
                    sectionIndex={sIdx}
                    register={register}
                    control={control}
                    errors={errors}
                    onRemove={sectionFields.length > 1 ? () => removeSection(sIdx) : undefined}
                  />
                ))}
              </div>

              {errors.sections?.message && (
                <p className="text-sm text-red-500">{errors.sections.message}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                >
                  {editingId ? 'Save Changes' : 'Create Template'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Template list */}
      {templates && templates.length > 0 ? (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                    <ClipboardCheck className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-slate-900">{t.name}</h4>
                    <p className="text-xs text-slate-500 truncate">
                      {t.category} &middot; {t.sections.length} section{t.sections.length !== 1 ? 's' : ''} &middot;{' '}
                      {t.sections.reduce((acc, s) => acc + s.fields.length, 0)} fields
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    >
                      {expandedId === t.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => startEdit(t)}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {expandedId === t.id && (
                  <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
                    {t.description && (
                      <p className="text-sm text-slate-600">{t.description}</p>
                    )}
                    {t.sections.map((s, sIdx) => (
                      <div key={sIdx} className="rounded-lg border border-slate-100 p-3">
                        <h5 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">
                          {s.name}
                        </h5>
                        <ul className="space-y-1">
                          {s.fields.map((f) => (
                            <li
                              key={f.id}
                              className="flex items-center gap-2 text-xs text-slate-600"
                            >
                              <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                {f.type.replace('_', ' ')}
                              </span>
                              <span>{f.label}</span>
                              {f.required && (
                                <span className="text-red-400 text-[10px]">required</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !showForm ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No checklist templates yet"
          description="Create templates with sections and fields for inspections, safety checks, and quality reviews."
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section editor sub-component for checklist form
// ---------------------------------------------------------------------------

function SectionEditor({
  sectionIndex,
  register,
  control,
  errors,
  onRemove,
}: {
  sectionIndex: number;
  register: ReturnType<typeof useForm<ChecklistTemplateForm>>['register'];
  control: ReturnType<typeof useForm<ChecklistTemplateForm>>['control'];
  errors: ReturnType<typeof useForm<ChecklistTemplateForm>>['formState']['errors'];
  onRemove?: () => void;
}) {
  const {
    fields: fieldItems,
    append: appendField,
    remove: removeField,
  } = useFieldArray({ control, name: `sections.${sectionIndex}.fields` });

  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-slate-300 flex-shrink-0" />
        <Input
          placeholder="Section name"
          className="flex-1"
          error={errors.sections?.[sectionIndex]?.name?.message}
          {...register(`sections.${sectionIndex}.name`)}
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-2 pl-6">
        {fieldItems.map((field, fIdx) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              placeholder="Field label"
              className="flex-1"
              error={errors.sections?.[sectionIndex]?.fields?.[fIdx]?.label?.message}
              {...register(`sections.${sectionIndex}.fields.${fIdx}.label`)}
            />
            <select
              className="h-12 rounded-lg border border-slate-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register(`sections.${sectionIndex}.fields.${fIdx}.type`)}
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>{ft.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                {...register(`sections.${sectionIndex}.fields.${fIdx}.required`)}
              />
              Req
            </label>
            {fieldItems.length > 1 && (
              <button
                type="button"
                onClick={() => removeField(fIdx)}
                className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() =>
            appendField({
              id: crypto.randomUUID(),
              label: '',
              type: 'checkbox',
              required: false,
            })
          }
        >
          <Plus className="h-3 w-3" />
          Add Field
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// REPORT TEMPLATES TAB
// ============================================================

function ReportTemplatesTab() {
  const { data: templates, isLoading } = useReportTemplates();
  const createMutation = useCreateReportTemplate();
  const deleteMutation = useDeleteReportTemplate();
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ReportTemplateForm>({
    resolver: zodResolver(reportTemplateSchema),
    defaultValues: {
      name: '',
      reportType: 'photo',
      sections: [
        { id: crypto.randomUUID(), title: '', notes: '', layout: 'grid' },
      ],
    },
  });

  const {
    fields: sectionFields,
    append: appendSection,
    remove: removeSection,
  } = useFieldArray({ control, name: 'sections' });

  const startCreate = () => {
    setShowForm(true);
    reset({
      name: '',
      reportType: 'photo',
      sections: [
        { id: crypto.randomUUID(), title: '', notes: '', layout: 'grid' },
      ],
    });
  };

  const onSubmit = async (data: ReportTemplateForm) => {
    await createMutation.mutateAsync({
      name: data.name,
      reportType: data.reportType,
      sectionsTemplate: data.sections.map((s) => ({
        id: s.id,
        title: s.title,
        notes: s.notes ?? '',
        layout: s.layout,
        photoIds: [],
      })),
    });

    setShowForm(false);
    reset();
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Pre-configure report section layouts and types.
        </p>
        <Button size="sm" onClick={startCreate}>
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">New Report Template</h3>
              <button onClick={() => setShowForm(false)}>
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g., Progress Photo Report"
                    error={errors.name?.message}
                    {...register('name')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Report Type</label>
                  <select
                    className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    {...register('reportType')}
                  >
                    {REPORT_TYPES.map((rt) => (
                      <option key={rt.value} value={rt.value}>{rt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-slate-800">Section Layout</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendSection({
                        id: crypto.randomUUID(),
                        title: '',
                        notes: '',
                        layout: 'grid',
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Section
                  </Button>
                </div>

                {sectionFields.map((section, sIdx) => (
                  <div
                    key={section.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 p-3"
                  >
                    <Input
                      placeholder="Section title"
                      className="flex-1"
                      error={errors.sections?.[sIdx]?.title?.message}
                      {...register(`sections.${sIdx}.title`)}
                    />
                    <select
                      className="h-12 rounded-lg border border-slate-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      {...register(`sections.${sIdx}.layout`)}
                    >
                      {REPORT_LAYOUTS.map((rl) => (
                        <option key={rl.value} value={rl.value}>{rl.label}</option>
                      ))}
                    </select>
                    {sectionFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSection(sIdx)}
                        className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  isLoading={createMutation.isPending}
                >
                  Create Template
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Template list */}
      {templates && templates.length > 0 ? (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50">
                  <FileText className="h-5 w-5 text-purple-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-slate-900">{t.name}</h4>
                  <p className="text-xs text-slate-500 truncate">
                    {t.reportType ?? 'custom'} &middot;{' '}
                    {t.sectionsTemplate.length} section{t.sectionsTemplate.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !showForm ? (
        <EmptyState
          icon={FileText}
          title="No report templates yet"
          description="Create templates to pre-configure report section layouts and types."
        />
      ) : null}
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function TemplatesPage() {
  const [activeTab, setActiveTab] = useState<TemplateTab>('project');

  return (
    <div className="flex flex-col min-h-[calc(100vh-48px)]">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Templates</h1>
        <p className="text-slate-500 text-sm">
          Create reusable templates for your projects
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'project' && <ProjectTemplatesTab />}
      {activeTab === 'checklist' && <ChecklistTemplatesTab />}
      {activeTab === 'report' && <ReportTemplatesTab />}
    </div>
  );
}
