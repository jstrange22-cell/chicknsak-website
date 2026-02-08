import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  SendHorizontal,
  Users,
  Paperclip,
  Bell,
  BellOff,
  Smile,
  Image as ImageIcon,
  X,
  Loader2,
  Pin,
  PinOff,
  Mic,
  Square,
  Clock,
  Calendar,
  Play,
  Pause,
  Trash2,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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
  usePinMessage,
  usePinnedMessages,
  useSendVoiceMessage,
  useScheduleMessage,
  useScheduledMessages,
  useCancelScheduledMessage,
  useSendScheduledNow,
} from '@/hooks/useMessages';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { Channel, Message } from '@/types';
import { MessageReactions } from '@/components/messages/MessageReactions';
import { TypingIndicator } from '@/components/messages/TypingIndicator';
import { ReadReceipts } from '@/components/messages/ReadReceipts';
import { MessageSearch } from '@/components/messages/MessageSearch';

// ---------------------------------------------------------------------------
// Emoji Data
// ---------------------------------------------------------------------------

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','😋','😛','😜','🤪','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'],
  },
  {
    name: 'Gestures',
    emojis: ['👍','👎','👊','✊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✌️','🤞','🤟','🤘','👌','🤌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤙','💪','🦾','🖕'],
  },
  {
    name: 'Objects',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💝','💘','⭐','🌟','✨','⚡','🔥','💯','🎉','🎊','🏆','🥇','🏅','🎯','💰','📱','💻','📷','📹','🔧','🔨','⚒️','🛠️','📋','📝','📌','📎','🔗','📁','📂'],
  },
  {
    name: 'Construction',
    emojis: ['🏗️','🏠','🏢','🏭','🧱','🪵','🪨','⛏️','🔩','🪛','🪚','🔧','🔨','⚒️','🛠️','🦺','👷','🚧','🏗️','📐','📏','🪜','🧲','🔌','💡','🚿','🪠','🧯','🗑️','📦','🚚','🚜'],
  },
];

// ---------------------------------------------------------------------------
// GIF Search Types
// ---------------------------------------------------------------------------

interface GifResult {
  id: string;
  previewUrl: string;
  fullUrl: string;
  width: number;
  height: number;
}

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

  // Pinned messages
  const { togglePin } = usePinMessage();
  const pinnedMessages = usePinnedMessages(channelId);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);

  // Voice messages
  const sendVoiceMessage = useSendVoiceMessage();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scheduled messages
  const scheduleMessage = useScheduleMessage();
  const { data: scheduledMessages = [] } = useScheduledMessages(channelId);
  const cancelScheduled = useCancelScheduledMessage();
  const sendScheduledNow = useSendScheduledNow();
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [showScheduledPanel, setShowScheduledPanel] = useState(false);

  const [body, setBody] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifSearch, setShowGifSearch] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Message['attachments']>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const gifSearchRef = useRef<HTMLDivElement>(null);

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

  // Close emoji/gif pickers on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (gifSearchRef.current && !gifSearchRef.current.contains(e.target as Node)) {
        setShowGifSearch(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // GIF search using Tenor (free, no API key needed for basic search)
  const searchGifs = useCallback(async (query: string) => {
    if (!query.trim()) {
      setGifResults([]);
      return;
    }
    setGifLoading(true);
    try {
      // Use Tenor's free API v2 with a generic key
      const apiKey = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ'; // Google's public Tenor key
      const resp = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${apiKey}&limit=20&media_filter=tinygif,gif`,
      );
      const data = await resp.json();
      const results: GifResult[] = (data.results ?? []).map((r: any) => ({
        id: r.id,
        previewUrl: r.media_formats?.tinygif?.url ?? r.media_formats?.gif?.url ?? '',
        fullUrl: r.media_formats?.gif?.url ?? r.media_formats?.tinygif?.url ?? '',
        width: r.media_formats?.tinygif?.dims?.[0] ?? 200,
        height: r.media_formats?.tinygif?.dims?.[1] ?? 150,
      }));
      setGifResults(results);
    } catch (err) {
      console.error('GIF search failed:', err);
      setGifResults([]);
    } finally {
      setGifLoading(false);
    }
  }, []);

  // Debounced GIF search
  useEffect(() => {
    if (!showGifSearch || !gifQuery.trim()) return;
    const timer = setTimeout(() => {
      void searchGifs(gifQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [gifQuery, showGifSearch, searchGifs]);

  // Load trending GIFs when opening GIF search
  useEffect(() => {
    if (showGifSearch && gifResults.length === 0 && !gifQuery) {
      void searchGifs('construction thumbs up');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGifSearch]);

  // Send a GIF as a message
  const handleSendGif = async (gif: GifResult) => {
    if (!channelId) return;
    setShowGifSearch(false);
    setGifQuery('');
    setGifResults([]);
    try {
      await sendMessage.mutateAsync({
        channelId,
        body: '',
        attachments: [{
          name: 'GIF',
          url: gif.fullUrl,
          thumbnailUrl: gif.previewUrl,
          type: 'image',
          size: 0,
        }],
      });
    } catch (err) {
      console.error('Failed to send GIF:', err);
    }
  };

  // File upload handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user?.uid) return;

    for (const file of Array.from(files)) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
        continue;
      }

      try {
        setUploadProgress(0);
        const storagePath = `messages/${channelId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(Math.round(progress));
            },
            (error) => {
              console.error('Upload failed:', error);
              reject(error);
            },
            async () => {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              const isImage = file.type.startsWith('image/');
              const attachment = {
                name: file.name,
                url: downloadUrl,
                type: isImage ? 'image' as const : 'file' as const,
                size: file.size,
                ...(isImage ? { thumbnailUrl: downloadUrl } : {}),
              };
              setPendingAttachments((prev) => [...(prev ?? []), attachment]);
              resolve();
            },
          );
        });
      } catch (err) {
        console.error('File upload failed:', err);
      } finally {
        setUploadProgress(null);
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove a pending attachment
  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => (prev ?? []).filter((_, i) => i !== index));
  };

  // Insert emoji at cursor
  const insertEmoji = (emoji: string) => {
    setBody((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 0 && channelId) {
          try {
            await sendVoiceMessage.mutateAsync({
              channelId,
              audioBlob,
              duration: recordingDuration,
            });
          } catch (err) {
            console.error('Failed to send voice message:', err);
          }
        }
        setRecordingDuration(0);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access is required to record voice messages.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  };

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Handle schedule send
  const handleScheduleSend = async () => {
    if (!body.trim() || !scheduleDate || !scheduleTime || !channelId) return;
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
    if (scheduledAt <= new Date()) {
      alert('Scheduled time must be in the future.');
      return;
    }
    try {
      await scheduleMessage.mutateAsync({
        channelId,
        body: body.trim(),
        scheduledAt,
        attachments: pendingAttachments ?? [],
      });
      setBody('');
      setPendingAttachments([]);
      setShowScheduler(false);
      setScheduleDate('');
      setScheduleTime('');
    } catch (err) {
      console.error('Failed to schedule message:', err);
    }
  };

  // Handle send
  const handleSend = async () => {
    const trimmed = body.trim();
    const hasAttachments = pendingAttachments && pendingAttachments.length > 0;
    if ((!trimmed && !hasAttachments) || !channelId) return;

    const attachmentsToSend = pendingAttachments ?? [];
    setBody('');
    setPendingAttachments([]);
    try {
      await sendMessage.mutateAsync({
        channelId,
        body: trimmed,
        attachments: attachmentsToSend,
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      // Restore body and attachments on error
      setBody(trimmed);
      setPendingAttachments(attachmentsToSend);
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

      {/* Pinned Messages Banner */}
      {pinnedMessages.length > 0 && (
        <button
          onClick={() => setShowPinnedPanel(!showPinnedPanel)}
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors w-full text-left"
        >
          <Pin className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{pinnedMessages.length} pinned message{pinnedMessages.length !== 1 ? 's' : ''}</span>
          {showPinnedPanel ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      )}

      {/* Pinned Messages Panel */}
      {showPinnedPanel && pinnedMessages.length > 0 && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50/50 max-h-48 overflow-y-auto">
          {pinnedMessages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-2 px-4 py-2 border-b border-amber-100 last:border-0">
              <Pin className="h-3 w-3 text-amber-500 mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700">{userNameMap[msg.userId]?.fullName ?? 'Unknown'}</p>
                <p className="text-xs text-slate-600 truncate">{msg.body || '[Attachment]'}</p>
              </div>
              <button
                onClick={() => {
                  const el = document.getElementById(`msg-${msg.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-amber-400', 'ring-offset-2');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400', 'ring-offset-2'), 2000);
                  }
                }}
                className="text-[10px] text-amber-600 hover:underline shrink-0"
              >
                Jump
              </button>
              <button
                onClick={() => void togglePin(msg.id, true)}
                className="p-1 text-amber-400 hover:text-red-500 transition-colors shrink-0"
                title="Unpin"
              >
                <PinOff className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Scheduled Messages Banner */}
      {scheduledMessages.length > 0 && (
        <button
          onClick={() => setShowScheduledPanel(!showScheduledPanel)}
          className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors w-full text-left"
        >
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{scheduledMessages.length} scheduled message{scheduledMessages.length !== 1 ? 's' : ''}</span>
          {showScheduledPanel ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      )}

      {/* Scheduled Messages Panel */}
      {showScheduledPanel && scheduledMessages.length > 0 && (
        <div className="shrink-0 border-b border-blue-200 bg-blue-50/50 max-h-48 overflow-y-auto">
          {scheduledMessages.map((msg) => {
            const schedTime = (msg.scheduledAt as any)?.toDate?.();
            return (
              <div key={msg.id} className="flex items-start gap-2 px-4 py-2 border-b border-blue-100 last:border-0">
                <Calendar className="h-3 w-3 text-blue-500 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-600 truncate">{msg.body}</p>
                  <p className="text-[10px] text-blue-500 mt-0.5">
                    {schedTime ? schedTime.toLocaleString() : 'Pending'}
                  </p>
                </div>
                <button
                  onClick={() => void sendScheduledNow.mutateAsync(msg.id)}
                  className="p-1 text-blue-500 hover:text-blue-700 transition-colors shrink-0"
                  title="Send now"
                >
                  <Send className="h-3 w-3" />
                </button>
                <button
                  onClick={() => void cancelScheduled.mutateAsync(msg.id)}
                  className="p-1 text-blue-400 hover:text-red-500 transition-colors shrink-0"
                  title="Cancel"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

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
                      <div className="max-w-[80%] relative group">
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

                          {/* Timestamp + pin indicator */}
                          <div className={cn(
                            'flex items-center gap-1 mt-1',
                            isCurrentUser ? 'text-blue-200' : 'text-slate-400',
                          )}>
                            <p className="text-[10px]">
                              {timeStr}
                              {msg.isEdited && ' (edited)'}
                            </p>
                            {msg.isPinned && (
                              <Pin className="h-2.5 w-2.5 text-amber-400" />
                            )}
                          </div>

                          {/* Voice message player */}
                          {msg.isVoiceMessage && msg.attachments?.[0]?.type === 'audio' && (
                            <VoiceMessagePlayer
                              url={msg.attachments[0].url}
                              duration={msg.audioDuration ?? msg.attachments[0].duration ?? 0}
                              isCurrentUser={isCurrentUser}
                            />
                          )}
                        </div>

                        {/* Pin / Unpin action */}
                        <button
                          onClick={() => void togglePin(msg.id, msg.isPinned)}
                          className={cn(
                            'absolute -top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-white shadow-sm border border-slate-200',
                            isCurrentUser ? 'left-0' : 'right-0',
                          )}
                          title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                        >
                          {msg.isPinned ? (
                            <PinOff className="h-3 w-3 text-amber-500" />
                          ) : (
                            <Pin className="h-3 w-3 text-slate-400" />
                          )}
                        </button>

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

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="shrink-0 border-t border-slate-200 bg-white"
        >
          <div className="max-h-56 overflow-y-auto px-3 py-2">
            {EMOJI_CATEGORIES.map((category) => (
              <div key={category.name} className="mb-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1 px-1">
                  {category.name}
                </p>
                <div className="flex flex-wrap gap-0.5">
                  {category.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => insertEmoji(emoji)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-xl hover:bg-slate-100 active:bg-slate-200 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GIF Search */}
      {showGifSearch && (
        <div
          ref={gifSearchRef}
          className="shrink-0 border-t border-slate-200 bg-white"
        >
          <div className="px-3 py-2">
            <input
              type="text"
              value={gifQuery}
              onChange={(e) => setGifQuery(e.target.value)}
              placeholder="Search GIFs..."
              className="w-full h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto px-3 pb-2">
            {gifLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : gifResults.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">
                {gifQuery ? 'No GIFs found' : 'Search for GIFs'}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {gifResults.map((gif) => (
                  <button
                    key={gif.id}
                    onClick={() => void handleSendGif(gif)}
                    className="rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
                  >
                    <img
                      src={gif.previewUrl}
                      alt="GIF"
                      className="w-full h-20 object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
            <p className="text-center text-[10px] text-slate-300 mt-2">Powered by Tenor</p>
          </div>
        </div>
      )}

      {/* Pending attachments preview */}
      {pendingAttachments && pendingAttachments.length > 0 && (
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex flex-wrap gap-2">
            {pendingAttachments.map((att, i) => (
              <div key={i} className="relative group">
                {att.type === 'image' ? (
                  <img
                    src={att.url}
                    alt={att.name}
                    className="h-16 w-16 rounded-lg object-cover border border-slate-200"
                  />
                ) : (
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-xs text-slate-600 max-w-[100px] truncate">{att.name}</span>
                  </div>
                )}
                <button
                  onClick={() => removePendingAttachment(i)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploadProgress !== null && (
        <div className="shrink-0 px-4 py-1 bg-blue-50 border-t border-blue-100">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-[11px] text-blue-600 font-medium">{uploadProgress}%</span>
          </div>
        </div>
      )}

      {/* Schedule Message Panel */}
      {showScheduler && (
        <div className="shrink-0 border-t border-slate-200 bg-blue-50 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold text-blue-700">Schedule Message</span>
            <button onClick={() => setShowScheduler(false)} className="ml-auto p-1 hover:bg-blue-100 rounded">
              <X className="h-3.5 w-3.5 text-blue-500" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="flex-1 h-9 rounded-lg border border-blue-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-28 h-9 rounded-lg border border-blue-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              size="sm"
              onClick={() => void handleScheduleSend()}
              disabled={!body.trim() || !scheduleDate || !scheduleTime || scheduleMessage.isPending}
              className="h-9 px-3 text-xs"
            >
              {scheduleMessage.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calendar className="h-3.5 w-3.5 mr-1" />}
              Schedule
            </Button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
          className="hidden"
          onChange={(e) => void handleFileSelect(e)}
        />

        {/* Recording mode */}
        {isRecording ? (
          <div className="flex items-center gap-3">
            <button
              onClick={cancelRecording}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-red-500 hover:bg-red-50 transition-colors"
              title="Cancel recording"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <div className="flex-1 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-600">
                {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
              </span>
              <div className="flex-1 h-1 bg-red-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all"
                  style={{ width: `${Math.min((recordingDuration / 120) * 100, 100)}%` }}
                />
              </div>
            </div>
            <button
              onClick={stopRecording}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              title="Stop and send"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {/* Attachment button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadProgress !== null}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-50"
              title="Attach file"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            {/* GIF button */}
            <button
              onClick={() => {
                setShowGifSearch(!showGifSearch);
                setShowEmojiPicker(false);
              }}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
                showGifSearch
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
              )}
              title="Send GIF"
            >
              <ImageIcon className="h-5 w-5" />
            </button>

            {/* Message input */}
            <input
              ref={inputRef}
              type="text"
              value={body}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 h-10 rounded-full border border-slate-300 bg-white px-4 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            {/* Emoji button */}
            <button
              onClick={() => {
                setShowEmojiPicker(!showEmojiPicker);
                setShowGifSearch(false);
              }}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
                showEmojiPicker
                  ? 'bg-yellow-100 text-yellow-600'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
              )}
              title="Add emoji"
            >
              <Smile className="h-5 w-5" />
            </button>

            {/* Schedule button */}
            <button
              onClick={() => {
                setShowScheduler(!showScheduler);
                setShowEmojiPicker(false);
                setShowGifSearch(false);
              }}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
                showScheduler
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
              )}
              title="Schedule message"
            >
              <Clock className="h-5 w-5" />
            </button>

            {/* Voice / Send toggle */}
            {body.trim() || (pendingAttachments && pendingAttachments.length > 0) ? (
              <Button
                size="icon"
                onClick={() => void handleSend()}
                disabled={sendMessage.isPending}
                className="h-10 w-10 rounded-full shrink-0"
              >
                <SendHorizontal className="h-5 w-5" />
              </Button>
            ) : (
              <button
                onClick={() => void startRecording()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                title="Record voice message"
              >
                <Mic className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice Message Player
// ---------------------------------------------------------------------------

function VoiceMessagePlayer({
  url,
  duration,
  isCurrentUser,
}: {
  url: string;
  duration: number;
  isCurrentUser: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    return () => {
      audio.pause();
      audio.src = '';
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [url]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      cancelAnimationFrame(animFrameRef.current);
      setIsPlaying(false);
    } else {
      void audio.play();
      setIsPlaying(true);
      const tick = () => {
        setCurrentTime(audio.currentTime);
        if (!audio.paused) {
          animFrameRef.current = requestAnimationFrame(tick);
        }
      };
      tick();
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <button
        onClick={togglePlayback}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
          isCurrentUser
            ? 'bg-blue-400 hover:bg-blue-300 text-white'
            : 'bg-slate-200 hover:bg-slate-300 text-slate-700',
        )}
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5 ml-0.5" />
        )}
      </button>
      <div className="flex-1 min-w-[80px]">
        <div className={cn(
          'h-1.5 rounded-full overflow-hidden',
          isCurrentUser ? 'bg-blue-400' : 'bg-slate-200',
        )}>
          <div
            className={cn(
              'h-full rounded-full transition-all duration-100',
              isCurrentUser ? 'bg-white' : 'bg-slate-600',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <span className={cn(
        'text-[10px] font-mono shrink-0',
        isCurrentUser ? 'text-blue-200' : 'text-slate-400',
      )}>
        {isPlaying ? formatTime(currentTime) : formatTime(duration)}
      </span>
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
