import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check, Loader2, Bookmark } from 'lucide-react';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useLabels, useCreateLabel, useUpdateLabel, useDeleteLabel, LABEL_GROUP_LABELS, DEFAULT_LABELS } from '@/hooks/useLabels';
import { TAG_COLORS } from '@/hooks/useTags';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { LabelGroup } from '@/types';

const LABEL_GROUPS: LabelGroup[] = ['status', 'type', 'priority', 'source', 'custom'];

export function LabelManagement() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;
  const { data: labels = [], isLoading } = useLabels(companyId);
  const createLabel = useCreateLabel();
  const updateLabel = useUpdateLabel();
  const deleteLabel = useDeleteLabel();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [newGroup, setNewGroup] = useState<LabelGroup>('custom');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleCreate = async () => {
    if (!companyId || !newName.trim()) return;
    await createLabel.mutateAsync({
      companyId,
      name: newName.trim(),
      color: newColor,
      labelGroup: newGroup,
      sortOrder: labels.length,
    });
    setNewName('');
    setShowAdd(false);
  };

  const handleSeedDefaults = async () => {
    if (!companyId) return;
    for (let i = 0; i < DEFAULT_LABELS.length; i++) {
      const label = DEFAULT_LABELS[i];
      const exists = labels.some((l) => l.name.toLowerCase() === label.name.toLowerCase());
      if (!exists) {
        await createLabel.mutateAsync({
          companyId,
          name: label.name,
          color: label.color,
          labelGroup: label.labelGroup,
          sortOrder: i,
        });
      }
    }
  };

  const handleStartEdit = (label: { id: string; name: string; color: string }) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateLabel.mutateAsync({
      labelId: editingId,
      updates: { name: editName.trim(), color: editColor },
    });
    setEditingId(null);
  };

  const handleDelete = async (labelId: string, labelName: string) => {
    if (window.confirm(`Delete label "${labelName}"?`)) {
      await deleteLabel.mutateAsync({ labelId });
    }
  };

  // Group labels
  const groupedLabels = LABEL_GROUPS.map((group) => ({
    group,
    label: LABEL_GROUP_LABELS[group],
    items: labels.filter((l) => (l.labelGroup || 'custom') === group),
  })).filter((g) => g.items.length > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{labels.length} labels</p>
        <div className="flex gap-2">
          {labels.length === 0 && (
            <Button size="sm" variant="outline" onClick={handleSeedDefaults}>
              Add Defaults
            </Button>
          )}
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Label
          </Button>
        </div>
      </div>

      {/* Add label form */}
      {showAdd && (
        <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Label name"
            autoFocus
          />
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Group</label>
            <select
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value as LabelGroup)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {LABEL_GROUPS.map((g) => (
                <option key={g} value={g}>{LABEL_GROUP_LABELS[g]}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {TAG_COLORS.slice(0, 12).map((color) => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={cn(
                  "w-7 h-7 rounded-full border-2",
                  newColor === color ? "border-slate-900 scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createLabel.isPending}>
              {createLabel.isPending ? 'Creating...' : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Grouped label list */}
      {groupedLabels.map(({ group, label, items }) => (
        <div key={group}>
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{label}</h4>
          <div className="space-y-1">
            {items.map((lbl) => (
              <div
                key={lbl.id}
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100"
              >
                {editingId === lbl.id ? (
                  <>
                    <div className="w-5 h-5 rounded flex-shrink-0" style={{ backgroundColor: editColor }} />
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 h-8 text-sm"
                      autoFocus
                    />
                    <button onClick={handleSaveEdit} className="text-green-600 hover:bg-green-50 p-1.5 rounded">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-50 p-1.5 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 rounded flex-shrink-0" style={{ backgroundColor: lbl.color }} />
                    <span className="flex-1 text-sm font-medium text-slate-900">{lbl.name}</span>
                    <button onClick={() => handleStartEdit(lbl)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-50">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(lbl.id, lbl.name)} className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {labels.length === 0 && !showAdd && (
        <div className="text-center py-8">
          <Bookmark className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 text-sm">No labels yet</p>
          <p className="text-xs text-slate-400 mt-1">Create labels to organize your projects</p>
        </div>
      )}
    </div>
  );
}
