import { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn, getInitials } from '@/lib/utils';
import { useCreateChannel, useCompanyUsers, useStartDirectMessage } from '@/hooks/useMessages';
import { useProjects } from '@/hooks/useProjects';
import { useAuthContext } from '@/components/auth/AuthProvider';
import type { ChannelType } from '@/types';

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (channelId: string) => void;
}

const channelTypes: { value: ChannelType; label: string; description: string }[] = [
  { value: 'direct', label: 'Direct Message', description: '1-on-1 conversation' },
  { value: 'group', label: 'Group', description: 'Team conversation' },
  { value: 'project', label: 'Project', description: 'Linked to a project' },
];

export function CreateChannelModal({
  isOpen,
  onClose,
  onCreated,
}: CreateChannelModalProps) {
  const { user } = useAuthContext();
  const createChannel = useCreateChannel();
  const startDM = useStartDirectMessage();
  const { data: companyUsers = [], isLoading: loadingUsers } = useCompanyUsers();
  const { data: projects = [], isLoading: loadingProjects } = useProjects();

  const [channelType, setChannelType] = useState<ChannelType>('direct');
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Filter out current user from selectable users
  const selectableUsers = companyUsers.filter((u) => u.id !== user?.uid);

  const toggleUser = (userId: string) => {
    if (channelType === 'direct') {
      // Single-select for DMs: toggle off if already selected, otherwise pick this one
      setSelectedUserIds((prev) =>
        prev.includes(userId) ? [] : [userId],
      );
    } else {
      setSelectedUserIds((prev) =>
        prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId],
      );
    }
  };

  const handleSubmit = async () => {
    setError('');

    // Direct message flow
    if (channelType === 'direct') {
      if (selectedUserIds.length !== 1) {
        setError('Select one person for a direct message');
        return;
      }
      try {
        const channelId = await startDM.mutateAsync(selectedUserIds[0]);
        // Reset form
        setName('');
        setProjectId('');
        setSelectedUserIds([]);
        setChannelType('direct');
        onClose();
        onCreated?.(channelId);
      } catch (err) {
        console.error('Failed to start direct message:', err);
        setError('Failed to start direct message. Please try again.');
      }
      return;
    }

    // Group / Project flow
    const channelName = channelType === 'project'
      ? projects.find((p) => p.id === projectId)?.name ?? ''
      : name.trim();

    if (channelType === 'group' && !channelName) {
      setError('Channel name is required');
      return;
    }
    if (channelType === 'project' && !projectId) {
      setError('Select a project');
      return;
    }
    if (selectedUserIds.length === 0) {
      setError('Select at least one member');
      return;
    }

    try {
      const result = await createChannel.mutateAsync({
        name: channelName,
        channelType,
        projectId: channelType === 'project' ? projectId : undefined,
        memberUserIds: selectedUserIds,
      });

      // Reset form
      setName('');
      setProjectId('');
      setSelectedUserIds([]);
      setChannelType('direct');
      onClose();
      onCreated?.(result.id);
    } catch (err) {
      console.error('Failed to create channel:', err);
      setError('Failed to create channel. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto">
      <div className="bg-white w-full min-h-screen md:min-h-0 md:max-w-lg md:my-8 md:rounded-xl md:shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:rounded-t-xl">
          <h2 className="text-lg font-semibold">
            {channelType === 'direct' ? 'New Message' : 'New Channel'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Channel type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Channel Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {channelTypes.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => { setChannelType(ct.value); setSelectedUserIds([]); }}
                  className={cn(
                    'flex flex-col items-start rounded-lg border p-3 text-left transition-colors',
                    channelType === ct.value
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-medium',
                      channelType === ct.value
                        ? 'text-blue-700'
                        : 'text-slate-700',
                    )}
                  >
                    {ct.label}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5">
                    {ct.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Channel name (group) */}
          {channelType === 'group' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Channel Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., General, Site Updates"
              />
            </div>
          )}

          {/* Project selector */}
          {channelType === 'project' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Project <span className="text-red-500">*</span>
              </label>
              {loadingProjects ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading projects...
                </div>
              ) : (
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Member selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              {channelType === 'direct' ? 'Send to' : 'Members'}{' '}
              <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-400">
              {channelType === 'direct'
                ? 'Select a person to message.'
                : 'You will be added automatically. Select others to add.'}
            </p>

            {loadingUsers ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading team members...
              </div>
            ) : selectableUsers.length === 0 ? (
              <p className="text-sm text-slate-400 py-3">
                No other team members found.
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {selectableUsers.map((member) => {
                  const isChecked = selectedUserIds.includes(member.id);
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleUser(member.id)}
                      className={cn(
                        'flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors',
                        isChecked ? 'bg-blue-50' : 'hover:bg-slate-50',
                      )}
                    >
                      {/* Checkbox / Radio */}
                      <div
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center border transition-colors',
                          channelType === 'direct' ? 'rounded-full' : 'rounded',
                          isChecked
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-slate-300',
                        )}
                      >
                        {isChecked && <Check className="h-3 w-3" />}
                      </div>

                      {/* Avatar */}
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.fullName}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                          {getInitials(member.fullName)}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {member.fullName}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {member.email}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedUserIds.length > 0 && channelType !== 'direct' && (
              <p className="text-xs text-slate-500">
                {selectedUserIds.length} member
                {selectedUserIds.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* Submit */}
          <div className="pt-2">
            <Button
              className="w-full"
              onClick={handleSubmit}
              isLoading={channelType === 'direct' ? startDM.isPending : createChannel.isPending}
            >
              {channelType === 'direct' ? 'Start Conversation' : 'Create Channel'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
