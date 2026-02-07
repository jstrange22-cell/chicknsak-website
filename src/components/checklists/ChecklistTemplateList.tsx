import { useState } from 'react';
import { ClipboardList, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { ChecklistTemplate, ChecklistCategory } from '@/types';

const CATEGORY_COLORS: Record<ChecklistCategory, string> = {
  inspection: 'bg-blue-100 text-blue-700',
  installation: 'bg-purple-100 text-purple-700',
  safety: 'bg-red-100 text-red-700',
  quality: 'bg-emerald-100 text-emerald-700',
  custom: 'bg-slate-100 text-slate-700',
};

const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  inspection: 'Inspection',
  installation: 'Installation',
  safety: 'Safety',
  quality: 'Quality',
  custom: 'Custom',
};

interface ChecklistTemplateListProps {
  templates: ChecklistTemplate[];
  isLoading?: boolean;
  onCreateNew: () => void;
  onEdit: (template: ChecklistTemplate) => void;
  onDelete: (templateId: string) => void;
  onSelect?: (template: ChecklistTemplate) => void;
  selectable?: boolean;
}

export default function ChecklistTemplateList({
  templates,
  isLoading,
  onCreateNew,
  onEdit,
  onDelete,
  onSelect,
  selectable = false,
}: ChecklistTemplateListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (templateId: string) => {
    setDeletingId(templateId);
    onDelete(templateId);
    setTimeout(() => setDeletingId(null), 1000);
  };

  const fieldCount = (template: ChecklistTemplate): number => {
    return template.sections.reduce((acc, section) => acc + section.fields.length, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          {selectable ? 'Choose a Template' : 'Checklist Templates'}
        </h3>
        {!selectable && (
          <Button size="sm" onClick={onCreateNew}>
            <Plus className="h-4 w-4" />
            Create Template
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No templates yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Create your first checklist template to get started
            </p>
            <Button className="mt-4" size="sm" onClick={onCreateNew}>
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={cn(
                'transition-colors',
                selectable && 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/50'
              )}
              onClick={() => selectable && onSelect?.(template)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900 truncate">
                      {template.name}
                    </h4>
                    {template.description && (
                      <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          CATEGORY_COLORS[template.category]
                        )}
                      >
                        {CATEGORY_LABELS[template.category]}
                      </span>
                      <span className="text-xs text-slate-400">
                        {template.sections.length} section{template.sections.length !== 1 ? 's' : ''} · {fieldCount(template)} field{fieldCount(template) !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {!selectable && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(template);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(template.id);
                        }}
                        disabled={deletingId === template.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deletingId === template.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
