import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ArrowLeft, SendHorizontal, Users, Paperclip, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn, formatRelativeTime, getInitials } from '@/lib/utils';
import {
  useChannelMessages,
  useChannelMembers,
  useMarkChannelRead,
  useSendMessage,
  useTyping,
  useMessageSearch,
  useMessageReadReceipts,
} from '@/hooks/useMessages';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Channel, Message } from '@/types';
import { MessageReactions } from '@/components/messages/MessageReactions';
import { TypingIndicator } from '@/components/messages/TypingIndicator';
import { ReadReceipts } from '@/components/messages/ReadReceipts';
import { MessageSearch } from '@/components/messages/MessageSearch';

interface ChannelViewProps {
  channelId: string;
  onBack?: () => void;
}

// ---------------------------------------------------------------------------
// Internal: grouped message type
// ---------------------------------------------------------------------------

interface MessageGroup {
  userId: string;
  userName: string;
  avatarUrl?: string;
  messages: Message[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChannelView({ channelId, onBack }: ChannelViewProps) {
  const { user } = useAuthContext();
  const { data: messages = [], isLoading: loadingMessages } =
    useChannelMessages(channelId);
  const { data: members = [] } = useChannelMembers(channelId);
  const markRead = useMarkChannelRead(channelId);
  const sendMessage = useSendMessage();
  const { handleTyping } = useTyping(channelId);
  const { markMessagesAsRead } = useMessageReadReceipts(channelId);
  const {
    searchQuery,
    searchResults,
    performSearch,
    clearSearch,
  } = useMessageSearch(messages);
  const {
    requestPermission,
    isSupported: pushSupported,
    permissionStatus,
    isRequesting: pushRequesting,
  } = usePushNotifications();

  const [body, setBody] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Fetch channel details
  const { data: channel } = useQuery({
    queryKey: ['channel', channelId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'channels', channelId));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as Channel;
    },
    enabled: !!channelId,
  });

  // Build a userId -> userName lookup from members
  const userNameMap = useMemo(() => {
    const map: Record<string, { fullName: string; avatarUrl?: string }> = {};
    for (const m of members) {
      map[m.id] = { fullName: m.fullName, avatarUrl: m.avatarUrl };
    }
    return map;
  }, [members]);

  // Group consecutive messages from the same user
  const groupedMessages = useMemo((): MessageGroup[] => {
    const groups: MessageGroup[] = [];
    for (const msg of messages) {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.userId === msg.userId) {
        lastGroup.messages.push(msg);
      } else {
        const info = userNameMap[msg.userId];
        groups.push({
          userId: msg.userId,
          userName: info?.fullName ?? 'Unknown User',
          avatarUrl: info?.avatarUrl,
          messages: [msg],
        });
      }
    }
    return groups;
  }, [messages, userNameMap]);

  // Mark channel as read on mount and when new messages arrive
  useEffect(() => {
    if (channelId) {
      markRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Mark read when new messages come in while viewing + update readBy
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && messages.length > 0) {
      markRead.mutate();

      // Mark recent messages as readBy current user
      const recentMessageIds = messages
        .slice(-5)
        .filter((m) => m.userId !== user?.uid)
        .map((m) => m.id);
      if (recentMessageIds.length > 0) {
        void markMessagesAsRead(recentMessageIds);
      }
    }
    prevMessageCountRef.current = messages.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Scroll to a specific message (for search results)
  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Briefly highlight the message
      el.classList.add('ring-2', 'ring-yellow-400', 'ring-offset-2');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-yellow-400', 'ring-offset-2');
      }, 2000);
    }
  }, []);

  // Handle send
  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || !channelId) return;

    setBody('');
    try {
      await sendMessage.mutateAsync({
        channelId,
        body: trimmed,
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      // Restore body on error
      setBody(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBody(e.target.value);
    handleTyping();
  };

  const pushEnabled = permissionStatus === 'granted';

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1.5 -ml-1.5 hover:bg-slate-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-slate-900 truncate">
            {channel?.name ?? 'Loading...'}
          </h3>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Users className="h-3 w-3" />
            <span>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Search + Push notification toggle */}
        <div className="flex items-center gap-1">
          <MessageSearch
            searchQuery={searchQuery}
            searchResults={searchResults}
            onSearch={performSearch}
            onClear={clearSearch}
            onSelectResult={scrollToMessage}
          />
          {pushSupported && (
            <button
              onClick={() => void requestPermission()}
              disabled={pushRequesting || pushEnabled}
              className={cn(
                'p-2 rounded-lg transition-colors',
                pushEnabled
                  ? 'text-blue-500 bg-blue-50'
                  : 'text-slate-500 hover:bg-slate-100',
              )}
              title={
                pushEnabled
                  ? 'Push notifications enabled'
                  : 'Enable push notifications'
              }
            >
              {pushEnabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4"
      >
        {loadingMessages ? (
          <div className="flex items-center justify-center h-32">
            <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <SendHorizontal className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              No messages yet
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          groupedMessages.map((group, groupIdx) => {
            const isCurrentUser = group.userId === user?.uid;
            return (
              <div key={`${group.userId}-${groupIdx}`} className="space-y-0.5">
                {/* User name header (only for first message in group) */}
                <div
                  className={cn(
                    'flex items-center gap-2 mb-1',
                    isCurrentUser ? 'justify-end' : 'justify-start',
                  )}
                >
                  {!isCurrentUser && (
                    <>
                      {group.avatarUrl ? (
                        <img
                          src={group.avatarUrl}
                          alt={group.userName}
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-600">
                          {getInitials(group.userName)}
                        </div>
                      )}
                      <span className="text-xs font-semibold text-slate-700">
                        {group.userName}
                      </span>
                    </>
                  )}
                  {isCurrentUser && (
                    <span className="text-xs font-semibold text-slate-500">
                      You
                    </span>
                  )}
                </div>

                {/* Individual messages in the group */}
                {group.messages.map((msg) => {
                  const timeStr = msg.createdAt?.toDate
                    ? formatRelativeTime(msg.createdAt.toDate())
                    : '';

                  return (
                    <div
                      key={msg.id}
                      id={`msg-${msg.id}`}
                      className={cn(
                        'flex transition-all duration-300 rounded-xl',
                        isCurrentUser ? 'justify-end' : 'justify-start',
                      )}
                    >
                      <div className="max-w-[80%]">
                        <div
                          className={cn(
                            'rounded-2xl px-3.5 py-2',
                            isCurrentUser
                              ? 'bg-blue-500 text-white rounded-br-md'
                              : 'bg-slate-100 text-slate-900 rounded-bl-md',
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.body}
                          </p>

                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              {msg.attachments.map((att, i) => (
                                <div key={i}>
                                  {att.type === 'image' ? (
                                    <a
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <img
                                        src={att.thumbnailUrl ?? att.url}
                                        alt={att.name}
                                        className="max-w-full max-h-48 rounded-lg object-cover"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={cn(
                                        'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                                        isCurrentUser
                                          ? 'border-blue-400 text-blue-100 hover:bg-blue-600'
                                          : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                                      )}
                                    >
                                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                      <span className="truncate">{att.name}</span>
                                      {att.size && (
                                        <span className="shrink-0 opacity-60">
                                          {formatFileSize(att.size)}
                                        </span>
                                      )}
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Timestamp */}
                          <p
                            className={cn(
                              'text-[10px] mt-1',
                              isCurrentUser
                                ? 'text-blue-200'
                                : 'text-slate-400',
                            )}
                          >
                            {timeStr}
                            {msg.isEdited && ' (edited)'}
                          </p>
                        </div>

                        {/* Reactions */}
                        <MessageReactions
                          messageId={msg.id}
                          reactions={msg.reactions}
                          isCurrentUser={isCurrentUser}
                        />

                        {/* Read receipts (only for own messages) */}
                        <ReadReceipts
                          readBy={msg.readBy}
                          isCurrentUser={isCurrentUser}
                          members={members}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      <TypingIndicator channelId={channelId} />

      {/* Input area */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={body}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 h-11 rounded-full border border-slate-300 bg-white px-4 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Button
            size="icon"
            onClick={() => void handleSend()}
            disabled={!body.trim() || sendMessage.isPending}
            className="h-11 w-11 rounded-full"
          >
            <SendHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
