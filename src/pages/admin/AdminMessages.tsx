import { useState, useMemo } from 'react';
import {
  MessageCircle,
  Trash2,
  Search,
  AlertTriangle,
  Hash,
  Users,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';
import { useChannels, useChannelMessages } from '@/hooks/useMessages';
import { useAuthContext } from '@/components/auth/AuthProvider';
import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ChannelType } from '@/types';

// ---------------------------------------------------------------------------
// Admin Messages Page
// ---------------------------------------------------------------------------

export default function AdminMessages() {
  useAuthContext(); // Ensure authenticated
  const { data: channels = [], isLoading: loadingChannels, refetch: refetchChannels } = useChannels();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'message' | 'channel'; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const q = searchQuery.toLowerCase();
    return channels.filter((ch) => ch.name.toLowerCase().includes(q));
  }, [channels, searchQuery]);

  const channelTypeIcon = (type: ChannelType) => {
    switch (type) {
      case 'project': return FolderOpen;
      case 'group': return Hash;
      case 'direct': return Users;
      default: return MessageCircle;
    }
  };

  // Delete an entire channel and all its messages/members
  const handleDeleteChannel = async (channelId: string) => {
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);

      // Delete all messages in channel
      const msgsQ = query(collection(db, 'messages'), where('channelId', '==', channelId));
      const msgsSnap = await getDocs(msgsQ);
      msgsSnap.docs.forEach((d) => batch.delete(d.ref));

      // Delete all channel members
      const membersQ = query(collection(db, 'channelMembers'), where('channelId', '==', channelId));
      const membersSnap = await getDocs(membersQ);
      membersSnap.docs.forEach((d) => batch.delete(d.ref));

      // Delete typing subcollection
      const typingSnap = await getDocs(collection(db, `channels/${channelId}/typing`));
      typingSnap.docs.forEach((d) => batch.delete(d.ref));

      // Delete the channel itself
      batch.delete(doc(db, 'channels', channelId));

      await batch.commit();
      setSelectedChannelId(null);
      void refetchChannels();
    } catch (err) {
      console.error('Failed to delete channel:', err);
      alert('Failed to delete channel. Please try again.');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Delete a single message
  const handleDeleteMessage = async (messageId: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'messages', messageId));
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert('Failed to delete message. Please try again.');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'channel') {
      await handleDeleteChannel(deleteTarget.id);
    } else {
      await handleDeleteMessage(deleteTarget.id);
    }
  };

  // Stats
  const totalChannels = channels.length;
  const projectChannels = channels.filter((c) => c.channelType === 'project').length;
  const groupChannels = channels.filter((c) => c.channelType === 'group').length;
  const directChannels = channels.filter((c) => c.channelType === 'direct').length;

  // If viewing a specific channel
  if (selectedChannelId) {
    const selectedChannel = channels.find((c) => c.id === selectedChannelId);
    return (
      <>
        <ChannelMessageManager
          channelId={selectedChannelId}
          channelName={selectedChannel?.name ?? 'Unknown'}
          onBack={() => setSelectedChannelId(null)}
          onDeleteMessage={(msgId, preview) =>
            setDeleteTarget({ type: 'message', id: msgId, name: preview })
          }
          onDeleteChannel={() =>
            setDeleteTarget({
              type: 'channel',
              id: selectedChannelId,
              name: selectedChannel?.name ?? 'Unknown',
            })
          }
        />

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <DeleteConfirmModal
            type={deleteTarget.type}
            name={deleteTarget.name}
            isDeleting={isDeleting}
            onConfirm={() => void confirmDelete()}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Channels" value={totalChannels} icon={MessageCircle} color="blue" />
          <StatCard label="Project" value={projectChannels} icon={FolderOpen} color="green" />
          <StatCard label="Group" value={groupChannels} icon={Hash} color="purple" />
          <StatCard label="Direct" value={directChannels} icon={Users} color="orange" />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels..."
            className="pl-9"
          />
        </div>

        {/* Channel list */}
        {loadingChannels ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">
              {searchQuery ? 'No channels found' : 'No messaging channels yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredChannels.map((channel) => {
              const TypeIcon = channelTypeIcon(channel.channelType as ChannelType);
              const lastMsg = (channel as any).lastMessage;
              const timeStr = lastMsg?.createdAt?.toDate
                ? formatRelativeTime(lastMsg.createdAt.toDate())
                : '';

              return (
                <div
                  key={channel.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <TypeIcon className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {channel.name}
                      </span>
                      <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                        {channel.channelType}
                      </span>
                    </div>
                    {lastMsg?.body && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {truncate(lastMsg.body, 60)}
                        {timeStr && ` · ${timeStr}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setSelectedChannelId(channel.id)}
                      className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      View <ChevronRight className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteTarget({
                          type: 'channel',
                          id: channel.id,
                          name: channel.name,
                        })
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Delete entire channel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          type={deleteTarget.type}
          name={deleteTarget.name}
          isDeleting={isDeleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Channel Message Manager — view and delete individual messages
// ---------------------------------------------------------------------------

function ChannelMessageManager({
  channelId,
  channelName,
  onBack,
  onDeleteMessage,
  onDeleteChannel,
}: {
  channelId: string;
  channelName: string;
  onBack: () => void;
  onDeleteMessage: (msgId: string, preview: string) => void;
  onDeleteChannel: () => void;
}) {
  const { data: messages = [], isLoading } = useChannelMessages(channelId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{channelName}</h3>
            <p className="text-xs text-slate-400">{messages.length} messages</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onDeleteChannel}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Delete Channel
        </Button>
      </div>

      {/* Messages */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No messages in this channel</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {messages.map((msg) => {
            const timeStr = (msg.createdAt as any)?.toDate
              ? formatRelativeTime((msg.createdAt as any).toDate())
              : '';

            return (
              <div
                key={msg.id}
                className="flex items-start gap-3 rounded-lg border border-slate-100 bg-white p-3 hover:border-slate-200 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      {msg.userId?.slice(0, 8)}...
                    </span>
                    {timeStr && (
                      <span className="text-[10px] text-slate-400">{timeStr}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 mt-0.5 break-words">
                    {msg.body || (msg.attachments?.length ? '[Attachment]' : '[Empty]')}
                  </p>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex gap-1.5 mt-1.5">
                      {msg.attachments.map((att, i) => (
                        <span
                          key={i}
                          className="text-[10px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded"
                        >
                          📎 {att.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() =>
                    onDeleteMessage(msg.id, truncate(msg.body || '[Attachment]', 30))
                  }
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete message"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colorMap[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Confirmation Modal
// ---------------------------------------------------------------------------

function DeleteConfirmModal({
  type,
  name,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  type: 'message' | 'channel';
  name: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Delete {type === 'channel' ? 'Channel' : 'Message'}?
            </h3>
            <p className="text-xs text-slate-500">This action cannot be undone</p>
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 px-3 py-2 mb-4">
          <p className="text-sm text-slate-600 break-words">
            {type === 'channel'
              ? `Delete "${name}" and all its messages, members, and data?`
              : `Delete message: "${name}"?`}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
