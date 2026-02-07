import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check, Loader2, Tag } from 'lucide-react';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useTags, useCreateTag, useUpdateTag, useDeleteTag, TAG_COLORS } from '@/hooks/useTags';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

const DEFAULT_TAGS = [
  { name: 'Foundation', color: '#8B5CF6' },
  { name: 'Framing', color: '#F97316' },
  { name: 'Rough-In', color: '#F59E0B' },
  { name: 'Insulation', color: '#3B82F6' },
  { name: 'Drywall', color: '#6B7280' },
  { name: 'Finished', color: '#10B981' },
  { name: 'Exterior', color: '#0EA5E9' },
  { name: 'Damage', color: '#EF4444' },
  { name: 'Before', color: '#6366F1' },
  { name: 'After', color: '#22C55E' },
  { name: 'Progress', color: '#F59E0B' },
];

export function TagManagement() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;
  const { data: tags = [], isLoading } = useTags(companyId);
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const handleCreate = async () => {
    if (!companyId || !newName.trim()) return;
    await createTag.mutateAsync({ companyId, name: newName.trim(), color: newColor });
    setNewName('');
    setShowAdd(false);
  };

  const handleSeedDefaults = async () => {
    if (!companyId) return;
    for (const tag of DEFAULT_TAGS) {
      const exists = tags.some((t) => t.name.toLowerCase() === tag.name.toLowerCase());
      if (!exists) {
        await createTag.mutateAsync({ companyId, name: tag.name, color: tag.color });
      }
    }
  };

  const handleStartEdit = (tag: { id: string; name: string; color: string }) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateTag.mutateAsync({
      tagId: editingId,
      updates: { name: editName.trim(), color: editColor },
    });
    setEditingId(null);
  };

  const handleDelete = async (tagId: string, tagName: string) => {
    if (window.confirm(`Delete tag "${tagName}"? This will remove it from all photos.`)) {
      await deleteTag.mutateAsync({ tagId });
    }
  };

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
        <p className="text-sm text-slate-500">{tags.length} tags</p>
        <div className="flex gap-2">
          {tags.length === 0 && (
            <Button size="sm" variant="outline" onClick={handleSeedDefaults}>
              Add Defaults
            </Button>
          )}
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Tag
          </Button>
        </div>
      </div>

      {/* Add tag form */}
      {showAdd && (
        <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Tag name"
            autoFocus
          />
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
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createTag.isPending}>
              {createTag.isPending ? 'Creating...' : 'Create'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Tag list */}
      <div className="space-y-1">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100"
          >
            {editingId === tag.id ? (
              <>
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0 cursor-pointer"
                  style={{ backgroundColor: editColor }}
                />
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 h-8 text-sm"
                  autoFocus
                />
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {TAG_COLORS.slice(0, 8).map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className={cn(
                        "w-5 h-5 rounded-full border",
                        editColor === color ? "border-slate-900" : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleSaveEdit}
                  className="text-green-600 hover:bg-green-50 p-1.5 rounded"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-slate-400 hover:bg-slate-50 p-1.5 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 text-sm font-medium text-slate-900">{tag.name}</span>
                <button
                  onClick={() => handleStartEdit(tag)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-50"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(tag.id, tag.name)}
                  className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {tags.length === 0 && !showAdd && (
        <div className="text-center py-8">
          <Tag className="h-10 w-10 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 text-sm">No tags yet</p>
          <p className="text-xs text-slate-400 mt-1">Create tags to organize your photos</p>
        </div>
      )}
    </div>
  );
}
