import { useState, useCallback } from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

import type {
  ChecklistFieldType,
  ChecklistCategory,
  TemplateField,
  TemplateSection,
} from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIELD_TYPE_LABELS: Record<ChecklistFieldType, string> = {
  checkbox: 'Checkbox',
  photo_required: 'Photo Required',
  yes_no: 'Yes/No',
  rating: 'Rating',
  multiple_choice: 'Multiple Choice',
  text: 'Text',
  signature: 'Signature',
  date: 'Date',
  number: 'Number',
};

const FIELD_TYPES = Object.entries(FIELD_TYPE_LABELS) as [
  ChecklistFieldType,
  string,
][];

const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
  inspection: 'Inspection',
  installation: 'Installation',
  safety: 'Safety',
  quality: 'Quality',
  custom: 'Custom',
};

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [
  ChecklistCategory,
  string,
][];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChecklistBuilderProps {
  initialName?: string;
  initialDescription?: string;
  initialCategory?: ChecklistCategory;
  initialSections?: TemplateSection[];
  onSave: (data: {
    name: string;
    description: string;
    category: ChecklistCategory;
    sections: TemplateSection[];
  }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createField(overrides?: Partial<TemplateField>): TemplateField {
  return {
    id: crypto.randomUUID(),
    label: '',
    type: 'checkbox',
    required: false,
    ...overrides,
  };
}

function createSection(overrides?: Partial<TemplateSection>): TemplateSection {
  return {
    name: 'New Section',
    fields: [createField()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MultipleChoiceEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
}

function MultipleChoiceEditor({ options, onChange }: MultipleChoiceEditorProps) {
  const [inputValue, setInputValue] = useState('');

  const addOption = () => {
    const trimmed = inputValue.trim();
    if (trimmed === '') return;

    // Support comma-separated entry
    const newOptions = trimmed
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    onChange([...options, ...newOptions]);
    setInputValue('');
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOption();
    }
  };

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs font-medium text-slate-500">Options</p>
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
            >
              {option}
              <button
                type="button"
                onClick={() => removeOption(idx)}
                className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                aria-label={`Remove option ${option}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add option (comma-separated)"
          className="h-8 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          className="shrink-0"
        >
          Add
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field Row
// ---------------------------------------------------------------------------

interface FieldRowProps {
  field: TemplateField;
  onUpdate: (updated: TemplateField) => void;
  onRemove: () => void;
}

function FieldRow({ field, onUpdate, onRemove }: FieldRowProps) {
  const handleTypeChange = (newType: ChecklistFieldType) => {
    const updated: TemplateField = { ...field, type: newType };
    // Clear type-specific data when switching types
    if (newType !== 'multiple_choice') {
      delete updated.options;
    } else if (!updated.options) {
      updated.options = [];
    }
    if (newType !== 'number') {
      delete updated.unit;
    }
    onUpdate(updated);
  };

  return (
    <div className="group rounded-lg border border-slate-200 bg-white p-3 transition-shadow hover:shadow-sm">
      <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
        {/* Grip handle */}
        <div className="mt-2 shrink-0 cursor-grab text-slate-300">
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Label */}
        <div className="min-w-0 flex-1">
          <Input
            value={field.label}
            onChange={(e) => onUpdate({ ...field, label: e.target.value })}
            placeholder="Field label"
            className="h-9 text-sm"
          />
        </div>

        {/* Type selector */}
        <select
          value={field.type}
          onChange={(e) =>
            handleTypeChange(e.target.value as ChecklistFieldType)
          }
          className="h-9 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        >
          {FIELD_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* Required toggle */}
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 self-center">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) =>
              onUpdate({ ...field, required: e.target.checked })
            }
            className="h-4 w-4 rounded border-slate-300 text-slate-800 focus:ring-slate-500"
          />
          <span className="text-xs text-slate-500">Required</span>
        </label>

        {/* Remove */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-9 w-9 shrink-0 text-slate-400 hover:text-red-500"
          aria-label="Remove field"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Multiple choice options */}
      {field.type === 'multiple_choice' && (
        <div className="ml-6">
          <MultipleChoiceEditor
            options={field.options ?? []}
            onChange={(options) => onUpdate({ ...field, options })}
          />
        </div>
      )}

      {/* Number unit */}
      {field.type === 'number' && (
        <div className="ml-6 mt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Unit</span>
            <Input
              value={field.unit ?? ''}
              onChange={(e) => onUpdate({ ...field, unit: e.target.value })}
              placeholder="e.g. mm, kg, psi"
              className="h-8 max-w-[200px] text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Panel
// ---------------------------------------------------------------------------

interface SectionPanelProps {
  section: TemplateSection;
  sectionIndex: number;
  isCollapsed: boolean;
  canRemove: boolean;
  onToggleCollapse: () => void;
  onUpdate: (updated: TemplateSection) => void;
  onRemove: () => void;
}

function SectionPanel({
  section,
  sectionIndex,
  isCollapsed,
  canRemove,
  onToggleCollapse,
  onUpdate,
  onRemove,
}: SectionPanelProps) {
  const updateField = (fieldIndex: number, updatedField: TemplateField) => {
    const updatedFields = [...section.fields];
    updatedFields[fieldIndex] = updatedField;
    onUpdate({ ...section, fields: updatedFields });
  };

  const removeField = (fieldIndex: number) => {
    const updatedFields = section.fields.filter((_, i) => i !== fieldIndex);
    onUpdate({ ...section, fields: updatedFields });
  };

  const addField = () => {
    onUpdate({ ...section, fields: [...section.fields, createField()] });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
          aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>

        <Input
          value={section.name}
          onChange={(e) => onUpdate({ ...section, name: e.target.value })}
          placeholder="Section name"
          className="h-8 flex-1 border-transparent bg-transparent text-sm font-semibold text-slate-800 placeholder:font-normal hover:border-slate-200 focus:border-slate-300 focus:bg-white"
        />

        <span className="shrink-0 text-xs text-slate-400">
          {section.fields.length} field{section.fields.length !== 1 ? 's' : ''}
        </span>

        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 shrink-0 text-slate-400 hover:text-red-500"
            aria-label={`Remove section ${sectionIndex + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Section body */}
      {!isCollapsed && (
        <div className="space-y-2 p-4">
          {section.fields.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              No fields yet. Add one below.
            </p>
          ) : (
            section.fields.map((field, fieldIdx) => (
              <FieldRow
                key={field.id}
                field={field}
                onUpdate={(updated) => updateField(fieldIdx, updated)}
                onRemove={() => removeField(fieldIdx)}
              />
            ))
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addField}
            className="mt-2 w-full border-dashed text-slate-500"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Field
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ChecklistBuilder({
  initialName = '',
  initialDescription = '',
  initialCategory = 'inspection',
  initialSections,
  onSave,
  onCancel,
  isSaving = false,
}: ChecklistBuilderProps) {
  // ---- Form state ----
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [category, setCategory] = useState<ChecklistCategory>(initialCategory);
  const [sections, setSections] = useState<TemplateSection[]>(
    initialSections && initialSections.length > 0
      ? initialSections
      : [createSection()],
  );

  // ---- UI state ----
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(
    () => new Set(),
  );
  const [errors, setErrors] = useState<string[]>([]);

  // ---- Section collapse toggle ----
  const toggleCollapse = useCallback((index: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // ---- Section CRUD ----
  const updateSection = useCallback(
    (index: number, updated: TemplateSection) => {
      setSections((prev) => {
        const next = [...prev];
        next[index] = updated;
        return next;
      });
    },
    [],
  );

  const removeSection = useCallback((index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
    setCollapsedSections((prev) => {
      const next = new Set<number>();
      for (const v of prev) {
        if (v < index) next.add(v);
        else if (v > index) next.add(v - 1);
      }
      return next;
    });
  }, []);

  const addSection = useCallback(() => {
    setSections((prev) => [...prev, createSection()]);
  }, []);

  // ---- Validation & Save ----
  const validate = useCallback((): string[] => {
    const validationErrors: string[] = [];

    if (name.trim() === '') {
      validationErrors.push('Template name is required.');
    }

    if (sections.length === 0) {
      validationErrors.push('At least one section is required.');
    }

    sections.forEach((section, sIdx) => {
      if (section.fields.length === 0) {
        validationErrors.push(
          `Section ${sIdx + 1} ("${section.name || 'Untitled'}") must have at least one field.`,
        );
      }

      section.fields.forEach((field, fIdx) => {
        if (field.label.trim() === '') {
          validationErrors.push(
            `Section ${sIdx + 1}, Field ${fIdx + 1} is missing a label.`,
          );
        }
      });
    });

    return validationErrors;
  }, [name, sections]);

  const handleSave = () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    onSave({
      name: name.trim(),
      description: description.trim(),
      category,
      sections,
    });
  };

  // ---- Render ----
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* ---- Header / Meta ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Template Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="template-name"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template Name"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="template-description"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Description
            </label>
            <textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={3}
              className={cn(
                'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900',
                'placeholder:text-slate-400',
                'focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400',
                'resize-y',
              )}
            />
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="template-category"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Category
            </label>
            <select
              id="template-category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ChecklistCategory)
              }
              className={cn(
                'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900',
                'focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400',
              )}
            >
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* ---- Sections ---- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Sections</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSection}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Section
          </Button>
        </div>

        {sections.map((section, idx) => (
          <SectionPanel
            key={idx}
            section={section}
            sectionIndex={idx}
            isCollapsed={collapsedSections.has(idx)}
            canRemove={sections.length > 1}
            onToggleCollapse={() => toggleCollapse(idx)}
            onUpdate={(updated) => updateSection(idx, updated)}
            onRemove={() => removeSection(idx)}
          />
        ))}
      </div>

      {/* ---- Validation Errors ---- */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-1 text-sm font-medium text-red-800">
            Please fix the following issues:
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-red-700">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Footer ---- */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="default"
          onClick={handleSave}
          isLoading={isSaving}
        >
          Save Template
        </Button>
      </div>
    </div>
  );
}

export default ChecklistBuilder;
