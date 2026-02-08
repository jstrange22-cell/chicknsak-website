import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import type { Channel, ChannelMember, Message, ChannelType } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ChannelWithPreview extends Channel {
  lastMessage?: { body: string; createdAt: Timestamp; userId: string };
}

interface ChannelMemberDoc extends ChannelMember {
  id: string;
}

// ---------------------------------------------------------------------------
// useChannels — all channels the current user belongs to, with last-message
// ---------------------------------------------------------------------------

export function useChannels() {
  const { user, profile } = useAuthContext();
  const userId = user?.uid;
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ['channels', userId, companyId],
    queryFn: async (): Promise<ChannelWithPreview[]> => {
      if (!userId || !companyId) return [];

      // 1. Get channel memberships for the current user
      const memberQ = query(
        collection(db, 'channelMembers'),
        where('userId', '==', userId),
      );
      const memberSnap = await getDocs(memberQ);
      const memberships = memberSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ChannelMemberDoc[];

      if (memberships.length === 0) return [];

      // 2. Fetch each channel document
      const channelIds = memberships.map((m) => m.channelId);
      const channels: ChannelWithPreview[] = [];

      // Firestore "in" queries support max 30 items; batch if needed
      const batches: string[][] = [];
      for (let i = 0; i < channelIds.length; i += 30) {
        batches.push(channelIds.slice(i, i + 30));
      }

      for (const batch of batches) {
        const channelQ = query(
          collection(db, 'channels'),
          where('__name__', 'in', batch),
        );
        const channelSnap = await getDocs(channelQ);
        channelSnap.docs.forEach((d) => {
          const data = d.data() as Omit<Channel, 'id'>;
          if (!data.isArchived) {
            channels.push({ id: d.id, ...data } as ChannelWithPreview);
          }
        });
      }

      // 2b. For direct channels, resolve the OTHER member's name
      const directChannels = channels.filter((c) => c.channelType === 'direct');
      if (directChannels.length > 0 && userId) {
        await Promise.all(
          directChannels.map(async (channel) => {
            const memberQ = query(
              collection(db, 'channelMembers'),
              where('channelId', '==', channel.id),
            );
            const memberSnap = await getDocs(memberQ);
            const otherUserId = memberSnap.docs
              .map((d) => d.data().userId as string)
              .find((id) => id !== userId);

            if (otherUserId) {
              const userDoc = await getDoc(doc(db, 'users', otherUserId));
              if (userDoc.exists()) {
                channel.name = (userDoc.data().fullName as string) ?? channel.name;
              }
            }
          }),
        );
      }

      // 3. Fetch last message for each channel
      await Promise.all(
        channels.map(async (channel) => {
          const msgQ = query(
            collection(db, 'messages'),
            where('channelId', '==', channel.id),
          );
          const msgSnap = await getDocs(msgQ);
          if (!msgSnap.empty) {
            // Sort client-side and pick the most recent
            const sorted = msgSnap.docs
              .map((d) => d.data())
              .sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() ?? 0;
                const bTime = b.createdAt?.toMillis?.() ?? 0;
                return bTime - aTime;
              });
            const msgData = sorted[0];
            channel.lastMessage = {
              body: msgData.body ?? '',
              createdAt: msgData.createdAt,
              userId: msgData.userId,
            };
          }
        }),
      );

      // Filter out project channels that have no messages yet
      const filteredChannels = channels.filter((c) => {
        if (c.channelType === 'project' && !c.lastMessage) return false;
        return true;
      });

      // 4. Sort by last message time (most recent first)
      filteredChannels.sort((a, b) => {
        const aTime = a.lastMessage?.createdAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.lastMessage?.createdAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });

      return filteredChannels;
    },
    enabled: !!userId && !!companyId,
  });
}

// ---------------------------------------------------------------------------
// useChannelMessages — real-time messages for a channel via onSnapshot
// ---------------------------------------------------------------------------

export function useChannelMessages(channelId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const msgQ = query(
      collection(db, 'messages'),
      where('channelId', '==', channelId),
    );

    const unsubscribe = onSnapshot(
      msgQ,
      (snapshot) => {
        const msgs = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Message[];
        // Filter out scheduled messages from the main view
        const visibleMsgs = msgs.filter((m) => !m.isScheduled);
        // Sort descending by createdAt, take last 50, then reverse for display
        visibleMsgs.sort((a, b) => {
          const aTime = (a.createdAt as any)?.toMillis?.() ?? 0;
          const bTime = (b.createdAt as any)?.toMillis?.() ?? 0;
          return bTime - aTime;
        });
        setMessages(visibleMsgs.slice(0, 50).reverse());
        setIsLoading(false);
      },
      (err) => {
        console.error('Messages snapshot error:', err);
        setError(err);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [channelId]);

  return { data: messages, isLoading, error };
}

// ---------------------------------------------------------------------------
// useSendMessage
// ---------------------------------------------------------------------------

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      channelId,
      body,
      attachments = [],
      mentions = [],
      parentMessageId,
    }: {
      channelId: string;
      body: string;
      attachments?: Message['attachments'];
      mentions?: string[];
      parentMessageId?: string;
    }) => {
      if (!user?.uid) throw new Error('Not authenticated');

      const messageData = {
        channelId,
        userId: user.uid,
        body,
        attachments,
        mentions,
        parentMessageId: parentMessageId ?? null,
        isEdited: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'messages'), messageData);
      return { id: docRef.id, ...messageData };
    },
    onSuccess: () => {
      // Invalidate channels to refresh last-message previews
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteMessage
// ---------------------------------------------------------------------------

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      await deleteDoc(doc(db, 'messages', messageId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useCreateChannel
// ---------------------------------------------------------------------------

export function useCreateChannel() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      name,
      channelType,
      description,
      projectId,
      memberUserIds,
    }: {
      name: string;
      channelType: ChannelType;
      description?: string;
      projectId?: string;
      memberUserIds: string[];
    }) => {
      if (!user?.uid || !profile?.companyId) throw new Error('Not authenticated');

      // Ensure creator is in the member list
      const allMembers = Array.from(new Set([user.uid, ...memberUserIds]));

      // 1. Create channel document
      const channelData = {
        companyId: profile.companyId,
        name,
        description: description ?? '',
        channelType,
        projectId: projectId ?? null,
        isArchived: false,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const channelRef = await addDoc(collection(db, 'channels'), channelData);
      const channelId = channelRef.id;

      // 2. Create channelMember documents for each member
      await Promise.all(
        allMembers.map((memberId) =>
          addDoc(collection(db, 'channelMembers'), {
            channelId,
            userId: memberId,
            role: memberId === user.uid ? 'owner' : 'member',
            lastReadAt: serverTimestamp(),
            joinedAt: serverTimestamp(),
          }),
        ),
      );

      return { id: channelId, ...channelData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useMarkChannelRead
// ---------------------------------------------------------------------------

export function useMarkChannelRead(channelId: string | undefined) {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user?.uid || !channelId) return;

      const memberQ = query(
        collection(db, 'channelMembers'),
        where('channelId', '==', channelId),
        where('userId', '==', user.uid),
      );
      const snap = await getDocs(memberQ);

      if (!snap.empty) {
        const memberDocRef = snap.docs[0].ref;
        await updateDoc(memberDocRef, { lastReadAt: serverTimestamp() });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unreadCounts'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useUnreadCounts — per-channel unread message counts
// ---------------------------------------------------------------------------

export function useUnreadCounts() {
  const { user } = useAuthContext();
  const userId = user?.uid;

  return useQuery({
    queryKey: ['unreadCounts', userId],
    queryFn: async (): Promise<Record<string, number>> => {
      if (!userId) return {};

      // 1. Get all memberships
      const memberQ = query(
        collection(db, 'channelMembers'),
        where('userId', '==', userId),
      );
      const memberSnap = await getDocs(memberQ);
      const memberships = memberSnap.docs.map((d) => d.data() as ChannelMember);

      if (memberships.length === 0) return {};

      // 2. For each channel, count messages after lastReadAt
      const counts: Record<string, number> = {};

      await Promise.all(
        memberships.map(async (membership) => {
          const { channelId, lastReadAt } = membership;
          if (!lastReadAt) {
            counts[channelId] = 0;
            return;
          }

          const unreadQ = query(
            collection(db, 'messages'),
            where('channelId', '==', channelId),
            where('createdAt', '>', lastReadAt),
          );
          const unreadSnap = await getDocs(unreadQ);

          // Exclude messages sent by the current user
          const unreadCount = unreadSnap.docs.filter(
            (d) => d.data().userId !== userId,
          ).length;

          counts[channelId] = unreadCount;
        }),
      );

      return counts;
    },
    enabled: !!userId,
    refetchInterval: 30_000, // Refresh every 30s
  });
}

// ---------------------------------------------------------------------------
// useTotalUnreadCount — sum of all unread (for nav badge)
// ---------------------------------------------------------------------------

export function useTotalUnreadCount(): number {
  const { data: counts } = useUnreadCounts();

  return useMemo(() => {
    if (!counts) return 0;
    return Object.values(counts).reduce((sum, n) => sum + n, 0);
  }, [counts]);
}

// ---------------------------------------------------------------------------
// useCompanyUsers — fetch users in the same company (for member selection)
// ---------------------------------------------------------------------------

export function useCompanyUsers() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ['companyUsers', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'users'),
        where('companyId', '==', companyId),
        where('isActive', '==', true),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Array<{ id: string; fullName: string; email: string; avatarUrl?: string; role: string }>;
    },
    enabled: !!companyId,
  });
}

// ---------------------------------------------------------------------------
// useChannelMembers — member list for a specific channel
// ---------------------------------------------------------------------------

export function useChannelMembers(channelId: string | undefined) {
  return useQuery({
    queryKey: ['channelMembers', channelId],
    queryFn: async () => {
      if (!channelId) return [];

      const memberQ = query(
        collection(db, 'channelMembers'),
        where('channelId', '==', channelId),
      );
      const memberSnap = await getDocs(memberQ);
      const memberUserIds = memberSnap.docs.map((d) => d.data().userId as string);

      if (memberUserIds.length === 0) return [];

      // Fetch user details for each member
      const users: Array<{ id: string; fullName: string; email: string; avatarUrl?: string }> = [];
      for (const uid of memberUserIds) {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          users.push({
            id: userDoc.id,
            fullName: data.fullName ?? 'Unknown',
            email: data.email ?? '',
            avatarUrl: data.avatarUrl,
          });
        }
      }

      return users;
    },
    enabled: !!channelId,
  });
}

// ---------------------------------------------------------------------------
// useReactions — add/remove emoji reactions on messages
// ---------------------------------------------------------------------------

export function useReactions() {
  const { user } = useAuthContext();

  const addReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user?.uid) return;
      const msgRef = doc(db, 'messages', messageId);
      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: arrayUnion(user.uid),
      });
    },
    [user?.uid],
  );

  const removeReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user?.uid) return;
      const msgRef = doc(db, 'messages', messageId);
      await updateDoc(msgRef, {
        [`reactions.${emoji}`]: arrayRemove(user.uid),
      });
    },
    [user?.uid],
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string, currentReactions?: Record<string, string[]>) => {
      if (!user?.uid) return;
      const users = currentReactions?.[emoji] ?? [];
      if (users.includes(user.uid)) {
        await removeReaction(messageId, emoji);
      } else {
        await addReaction(messageId, emoji);
      }
    },
    [user?.uid, addReaction, removeReaction],
  );

  return { addReaction, removeReaction, toggleReaction };
}

// ---------------------------------------------------------------------------
// useTyping — set/clear typing indicator for current user
// ---------------------------------------------------------------------------

export function useTyping(channelId: string | undefined) {
  const { user } = useAuthContext();
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (!user?.uid || !channelId) return;

      const typingRef = doc(db, `channels/${channelId}/typing`, user.uid);

      if (isTyping) {
        await setDoc(typingRef, {
          userId: user.uid,
          timestamp: serverTimestamp(),
        });
      } else {
        try {
          await deleteDoc(typingRef);
        } catch {
          // Ignore errors when deleting (document may not exist)
        }
      }
    },
    [user?.uid, channelId],
  );

  // Auto-clear typing after 3 seconds of no typing events
  const handleTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    void setTyping(true);

    typingTimeoutRef.current = setTimeout(() => {
      void setTyping(false);
    }, 3000);
  }, [setTyping]);

  // Clean up on unmount or channel change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      void setTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  return { handleTyping, setTyping };
}

// ---------------------------------------------------------------------------
// useTypingUsers — listen for who is typing in a channel
// ---------------------------------------------------------------------------

interface TypingUser {
  userId: string;
  fullName: string;
}

export function useTypingUsers(channelId: string | undefined) {
  const { user } = useAuthContext();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  useEffect(() => {
    if (!channelId) {
      setTypingUsers([]);
      return;
    }

    const typingRef = collection(db, `channels/${channelId}/typing`);
    const unsubscribe = onSnapshot(typingRef, async (snapshot) => {
      const now = Date.now();
      const activeUsers: TypingUser[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const userId = data.userId as string;

        // Skip the current user
        if (userId === user?.uid) continue;

        // Skip entries older than 5 seconds (stale)
        const timestamp = data.timestamp?.toDate?.();
        if (timestamp && now - timestamp.getTime() > 5000) continue;

        // Fetch user name
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            activeUsers.push({
              userId,
              fullName: (userDoc.data().fullName as string) ?? 'Someone',
            });
          }
        } catch {
          activeUsers.push({ userId, fullName: 'Someone' });
        }
      }

      setTypingUsers(activeUsers);
    });

    return () => unsubscribe();
  }, [channelId, user?.uid]);

  return typingUsers;
}

// ---------------------------------------------------------------------------
// useMessageReadReceipts — mark messages as read and track readBy
// ---------------------------------------------------------------------------

export function useMessageReadReceipts(channelId: string | undefined) {
  const { user } = useAuthContext();

  const markMessagesAsRead = useCallback(
    async (messageIds: string[]) => {
      if (!user?.uid || !channelId || messageIds.length === 0) return;

      await Promise.all(
        messageIds.map((msgId) =>
          updateDoc(doc(db, 'messages', msgId), {
            readBy: arrayUnion(user.uid),
          }),
        ),
      );
    },
    [user?.uid, channelId],
  );

  return { markMessagesAsRead };
}

// ---------------------------------------------------------------------------
// useMessageSearch — client-side search through loaded messages
// ---------------------------------------------------------------------------

export function useMessageSearch(messages: Message[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);

  const performSearch = useCallback(
    (queryStr: string) => {
      setSearchQuery(queryStr);

      if (!queryStr.trim()) {
        setSearchResults([]);
        return;
      }

      const lower = queryStr.toLowerCase();
      const results = messages.filter((msg) =>
        msg.body.toLowerCase().includes(lower),
      );
      setSearchResults(results);
    },
    [messages],
  );

  // Re-run search when messages change
  useEffect(() => {
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      const results = messages.filter((msg) =>
        msg.body.toLowerCase().includes(lower),
      );
      setSearchResults(results);
    }
  }, [messages, searchQuery]);

  return {
    searchQuery,
    searchResults,
    performSearch,
    clearSearch: () => {
      setSearchQuery('');
      setSearchResults([]);
    },
  };
}

// ---------------------------------------------------------------------------
// useStartDirectMessage — find or create a 1-on-1 DM channel
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// usePinMessage — pin/unpin a message
// ---------------------------------------------------------------------------

export function usePinMessage() {
  const { user } = useAuthContext();

  const pinMessage = useCallback(
    async (messageId: string) => {
      if (!user?.uid) return;
      const msgRef = doc(db, 'messages', messageId);
      await updateDoc(msgRef, {
        isPinned: true,
        pinnedAt: serverTimestamp(),
        pinnedBy: user.uid,
      });
    },
    [user?.uid],
  );

  const unpinMessage = useCallback(
    async (messageId: string) => {
      if (!user?.uid) return;
      const msgRef = doc(db, 'messages', messageId);
      await updateDoc(msgRef, {
        isPinned: false,
        pinnedAt: null,
        pinnedBy: null,
      });
    },
    [user?.uid],
  );

  const togglePin = useCallback(
    async (messageId: string, currentlyPinned?: boolean) => {
      if (currentlyPinned) {
        await unpinMessage(messageId);
      } else {
        await pinMessage(messageId);
      }
    },
    [pinMessage, unpinMessage],
  );

  return { pinMessage, unpinMessage, togglePin };
}

// ---------------------------------------------------------------------------
// usePinnedMessages — get pinned messages for a channel
// ---------------------------------------------------------------------------

export function usePinnedMessages(channelId: string | undefined) {
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!channelId) {
      setPinnedMessages([]);
      return;
    }

    const pinnedQ = query(
      collection(db, 'messages'),
      where('channelId', '==', channelId),
      where('isPinned', '==', true),
    );

    const unsubscribe = onSnapshot(pinnedQ, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Message[];
      msgs.sort((a, b) => {
        const aTime = (a.pinnedAt as any)?.toMillis?.() ?? 0;
        const bTime = (b.pinnedAt as any)?.toMillis?.() ?? 0;
        return bTime - aTime;
      });
      setPinnedMessages(msgs);
    });

    return () => unsubscribe();
  }, [channelId]);

  return pinnedMessages;
}

// ---------------------------------------------------------------------------
// useSendVoiceMessage — send a voice message with audio upload
// ---------------------------------------------------------------------------

export function useSendVoiceMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      channelId,
      audioBlob,
      duration,
    }: {
      channelId: string;
      audioBlob: Blob;
      duration: number;
    }) => {
      if (!user?.uid) throw new Error('Not authenticated');

      // Import storage dynamically to avoid circular deps
      const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('@/lib/firebase');

      const fileName = `voice_${Date.now()}.webm`;
      const storagePath = `messages/${channelId}/voice/${fileName}`;
      const storageRef = ref(storage, storagePath);

      // Upload audio
      const uploadTask = uploadBytesResumable(storageRef, audioBlob, {
        contentType: 'audio/webm',
      });

      const downloadUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          null,
          (error) => reject(error),
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          },
        );
      });

      // Create message
      const messageData = {
        channelId,
        userId: user.uid,
        body: '',
        attachments: [{
          type: 'audio' as const,
          url: downloadUrl,
          name: fileName,
          duration,
        }],
        mentions: [],
        parentMessageId: null,
        isEdited: false,
        isVoiceMessage: true,
        audioDuration: duration,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'messages'), messageData);
      return { id: docRef.id, ...messageData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useScheduleMessage — create a scheduled message
// ---------------------------------------------------------------------------

export function useScheduleMessage() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      channelId,
      body,
      scheduledAt,
      attachments = [],
      mentions = [],
    }: {
      channelId: string;
      body: string;
      scheduledAt: Date;
      attachments?: Message['attachments'];
      mentions?: string[];
    }) => {
      if (!user?.uid) throw new Error('Not authenticated');

      const messageData = {
        channelId,
        userId: user.uid,
        body,
        attachments,
        mentions,
        parentMessageId: null,
        isEdited: false,
        isScheduled: true,
        scheduledAt: Timestamp.fromDate(scheduledAt),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'messages'), messageData);
      return { id: docRef.id, ...messageData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['scheduledMessages'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useScheduledMessages — get scheduled messages for a channel
// ---------------------------------------------------------------------------

export function useScheduledMessages(channelId: string | undefined) {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['scheduledMessages', channelId, user?.uid],
    queryFn: async (): Promise<Message[]> => {
      if (!channelId || !user?.uid) return [];

      const scheduledQ = query(
        collection(db, 'messages'),
        where('channelId', '==', channelId),
        where('userId', '==', user.uid),
        where('isScheduled', '==', true),
      );
      const snap = await getDocs(scheduledQ);
      const msgs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Message[];

      // Sort by scheduledAt ascending
      msgs.sort((a, b) => {
        const aTime = (a.scheduledAt as any)?.toMillis?.() ?? 0;
        const bTime = (b.scheduledAt as any)?.toMillis?.() ?? 0;
        return aTime - bTime;
      });

      return msgs;
    },
    enabled: !!channelId && !!user?.uid,
    refetchInterval: 30_000,
  });
}

// ---------------------------------------------------------------------------
// useCancelScheduledMessage — delete a scheduled message
// ---------------------------------------------------------------------------

export function useCancelScheduledMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      await deleteDoc(doc(db, 'messages', messageId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledMessages'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useSendScheduledNow — send a scheduled message immediately
// ---------------------------------------------------------------------------

export function useSendScheduledNow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: string) => {
      const msgRef = doc(db, 'messages', messageId);
      await updateDoc(msgRef, {
        isScheduled: false,
        scheduledAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledMessages'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

// ---------------------------------------------------------------------------
// useStartDirectMessage — find or create a 1-on-1 DM channel
// ---------------------------------------------------------------------------

export function useStartDirectMessage() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuthContext();

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user?.uid || !profile?.companyId) throw new Error('Not authenticated');

      // Check for existing DM channel between these two users
      const myMembershipsQ = query(
        collection(db, 'channelMembers'),
        where('userId', '==', user.uid),
      );
      const myMemberships = await getDocs(myMembershipsQ);
      const myChannelIds = myMemberships.docs.map((d) => d.data().channelId as string);

      // For each of my channels, check if target is also a member AND it's a direct channel
      for (const channelId of myChannelIds) {
        const channelDoc = await getDoc(doc(db, 'channels', channelId));
        if (!channelDoc.exists()) continue;
        const channelData = channelDoc.data();
        if (channelData.channelType !== 'direct') continue;

        // Check if target user is a member
        const targetMemberQ = query(
          collection(db, 'channelMembers'),
          where('channelId', '==', channelId),
          where('userId', '==', targetUserId),
        );
        const targetMemberSnap = await getDocs(targetMemberQ);
        if (!targetMemberSnap.empty) {
          return channelId; // Existing DM found
        }
      }

      // No existing DM — fetch target user name and create new channel
      const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
      const targetName = targetUserDoc.exists()
        ? (targetUserDoc.data().fullName as string) ?? 'Unknown'
        : 'Unknown';

      const channelData = {
        companyId: profile.companyId,
        name: targetName, // Will be displayed differently per user
        description: '',
        channelType: 'direct' as ChannelType,
        projectId: null,
        isArchived: false,
        createdBy: user.uid,
        memberIds: [user.uid, targetUserId], // Store member IDs on channel for easy lookup
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const channelRef = await addDoc(collection(db, 'channels'), channelData);

      // Create member documents
      await Promise.all([
        addDoc(collection(db, 'channelMembers'), {
          channelId: channelRef.id,
          userId: user.uid,
          role: 'member',
          lastReadAt: serverTimestamp(),
          joinedAt: serverTimestamp(),
        }),
        addDoc(collection(db, 'channelMembers'), {
          channelId: channelRef.id,
          userId: targetUserId,
          role: 'member',
          lastReadAt: serverTimestamp(),
          joinedAt: serverTimestamp(),
        }),
      ]);

      return channelRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}
