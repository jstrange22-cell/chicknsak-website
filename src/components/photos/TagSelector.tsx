import { useState } from 'react';
import type { Tag } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { X, Check, Plus, Search } from 'lucide-react';
import { useCreateTag, TAG_COLORS } from '@/hooks/useTags';

interface TagSelectorProps {
  tags: Tag[];
  selectedTagIds: string[];
  onSelect: (tagId: string) => void;
  onClose: () => void;
  companyId?: string;
}

export function TagSelector({
  tags,
  selectedTagIds,
  onSelect,
  onClose,
  companyId,
}: TagSelectorProps) {
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const createTag = useCreateTag();

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !companyId) return;

    const tagId = await createTag.mutateAsync({
      companyId,
      name: newTagName.trim(),
      color: newTagColor,
    });

    onSelect(tagId);
    setNewTagName('');
    setIsCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-t-xl sm:rounded-xl shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Add Tags</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Tag list */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredTags.length === 0 && !isCreating ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No tags found</p>
              {companyId && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setIsCreating(true);
                    setNewTagName(search);
                  }}
                >
                  Create "{search || 'new tag'}"
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors',
                      isSelected && 'bg-gray-100'
                    )}
                    onClick={() => onSelect(tag.id)}
                    disabled={isSelected}
                  >
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-left">{tag.name}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Create new tag form */}
          {isCreating && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Tag Name</label>
                <Input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Enter tag name..."
                  className="mt-1"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Color</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-transform',
                        newTagColor === color
                          ? 'border-gray-900 scale-110'
                          : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewTagColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || createTag.isPending}
                >
                  {createTag.isPending ? 'Creating...' : 'Create Tag'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewTagName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {companyId && !isCreating && (
          <div className="p-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsCreating(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Tag
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
