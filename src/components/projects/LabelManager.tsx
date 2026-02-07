import { useState } from 'react';
import { Bookmark, X, Check, ChevronDown } from 'lucide-react';
import { useLabels, LABEL_GROUP_LABELS } from '@/hooks/useLabels';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/utils';
import type { LabelGroup } from '@/types';

interface LabelManagerProps {
  selectedLabelIds: string[];
  onToggleLabel: (labelId: string) => void;
}

export function LabelManager({ selectedLabelIds, onToggleLabel }: LabelManagerProps) {
  const { profile } = useAuthContext();
  const { data: labels = [] } = useLabels(profile?.companyId);
  const [isOpen, setIsOpen] = useState(false);

  // Group labels
  const groups = (['status', 'type', 'priority', 'source', 'custom'] as LabelGroup[])
    .map((group) => ({
      group,
      label: LABEL_GROUP_LABELS[group],
      items: labels.filter((l) => (l.labelGroup || 'custom') === group),
    }))
    .filter((g) => g.items.length > 0);

  const selectedLabels = labels.filter((l) => selectedLabelIds.includes(l.id));

  return (
    <div className="relative">
      {/* Selected labels display */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selectedLabels.map((label) => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white"
            style={{ backgroundColor: label.color }}
          >
            {label.name}
            <button
              onClick={() => onToggleLabel(label.id)}
              className="hover:bg-white/20 rounded-full p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-600"
      >
        <Bookmark className="w-4 h-4" />
        Manage Labels
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Popover */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3 max-h-80 overflow-y-auto">
            {groups.map(({ group, label, items }) => (
              <div key={group} className="mb-3 last:mb-0">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                {items.map((lbl) => {
                  const isSelected = selectedLabelIds.includes(lbl.id);
                  return (
                    <button
                      key={lbl.id}
                      onClick={() => onToggleLabel(lbl.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 text-left"
                    >
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center",
                        isSelected ? "bg-blue-500 border-blue-500" : "border-slate-300"
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: lbl.color }}
                      />
                      <span className="text-sm text-slate-700">{lbl.name}</span>
                    </button>
                  );
                })}
              </div>
            ))}
            {labels.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">
                No labels yet. Create labels in Settings.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
