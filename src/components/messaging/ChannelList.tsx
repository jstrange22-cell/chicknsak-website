import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Hash,
  Users,
  MessageCircle,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn, truncate, formatRelativeTime } from '@/lib/utils';
import { useChannels, useUnreadCounts } from '@/hooks/useMessages';
import type { ChannelType } from '@/types';

interface ChannelListProps {
  onSelectChannel: (channelId: string) => void;
  selectedChannelId?: string;
  onNewChannel?: () => void;
}

const channelTypeConfig: Record<
  ChannelType,
  { label: string; icon: typeof Hash }
> = {
  project: { label: 'Project', icon: FolderOpen },
  group: { label: 'Group', icon: Users },
  direct: { label: 'Direct Messages', icon: MessageCircle },
};

const groupOrder: ChannelType[] = ['project', 'group', 'direct'];

export function ChannelList({
  onSelectChannel,
  selectedChannelId,
  onNewChannel,
}: ChannelListProps) {
  const { data: channels = [], isLoading } = useChannels();
  const { data: unreadCounts = {} } = useUnreadCounts();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter channels by search
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return channels;
    const q = searchQuery.toLowerCase();
    return channels.filter(
      (ch) =>
        ch.name.toLowerCase().includes(q) ||
        ch.description?.toLowerCase().includes(q),
    );
  }, [channels, searchQuery]);

  // Group by channel type
  const grouped = useMemo(() => {
    const groups: Record<ChannelType, typeof filtered> = {
      project: [],
      group: [],
      direct: [],
    };
    for (const ch of filtered) {
      const type = ch.channelType ?? 'group';
      if (groups[type]) {
        groups[type].push(ch);
      }
    }
    return groups;
  }, [filtered]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Messages</h2>
        <Button size="sm" onClick={onNewChannel}>
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 py-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels..."
            className="pl-9 h-10"
          />
        </div>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 px-4 text-center">
            <MessageCircle className="h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-600">
              {searchQuery ? 'No channels found' : 'No conversations yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery
                ? 'Try a different search term'
                : 'Create a channel to start messaging'}
            </p>
          </div>
        ) : (
          groupOrder.map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;

            const config = channelTypeConfig[type];
            const GroupIcon = config.icon;

            return (
              <div key={type}>
                {/* Group header */}
                <div className="flex items-center gap-2 px-4 py-2 mt-1">
                  <GroupIcon className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {config.label}
                  </span>
                </div>

                {/* Channel rows */}
                {items.map((channel) => {
                  const unread = unreadCounts[channel.id] ?? 0;
                  const isSelected = selectedChannelId === channel.id;
                  const lastMsg = channel.lastMessage;
                  const preview = lastMsg?.body
                    ? truncate(lastMsg.body, 40)
                    : 'No messages yet';
                  const timeStr = lastMsg?.createdAt?.toDate
                    ? formatRelativeTime(lastMsg.createdAt.toDate())
                    : '';

                  return (
                    <button
                      key={channel.id}
                      onClick={() => onSelectChannel(channel.id)}
                      className={cn(
                        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                        isSelected && 'bg-blue-50 hover:bg-blue-50',
                      )}
                    >
                      {/* Channel icon */}
                      <div
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {type === 'direct' ? (
                          <MessageCircle className="h-4 w-4" />
                        ) : type === 'project' ? (
                          <FolderOpen className="h-4 w-4" />
                        ) : (
                          <Hash className="h-4 w-4" />
                        )}
                      </div>

                      {/* Text content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              'text-sm truncate',
                              unread > 0
                                ? 'font-semibold text-slate-900'
                                : 'font-medium text-slate-700',
                            )}
                          >
                            {channel.name}
                          </span>
                          {timeStr && (
                            <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                              {timeStr}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p
                            className={cn(
                              'text-xs truncate',
                              unread > 0
                                ? 'text-slate-600 font-medium'
                                : 'text-slate-400',
                            )}
                          >
                            {preview}
                          </p>
                          {unread > 0 && (
                            <span className="ml-2 shrink-0 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-[11px] font-bold text-white">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
