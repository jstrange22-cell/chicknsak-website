import { useEffect, useRef, useCallback } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';

/**
 * Global hook that monitors all channels the user belongs to and shows
 * browser notifications for new incoming messages.
 *
 * This runs at the app-layout level so it works regardless of which page
 * the user is viewing. Uses Firestore onSnapshot for real-time delivery.
 *
 * No FCM / Cloud Functions needed — purely client-side with Firestore
 * real-time listeners + the browser Notification API.
 */
export function useMessageNotifications() {
  const { user, profile } = useAuthContext();
  const userId = user?.uid;

  // Track when the hook started listening (ignore messages older than this)
  const listeningSince = useRef<number>(Date.now());

  // Track which channel is currently being viewed (to suppress notifications)
  const activeChannelId = useRef<string | null>(null);

  // Cache user names so we don't re-fetch every time
  const userNameCache = useRef<Record<string, string>>({});

  // Expose setter for active channel
  const setActiveChannel = useCallback((channelId: string | null) => {
    activeChannelId.current = channelId;
  }, []);

  useEffect(() => {
    if (!userId || !profile?.companyId) return;

    // Reset the listening timestamp when the hook mounts
    listeningSince.current = Date.now();

    let channelUnsubscribes: (() => void)[] = [];

    // Step 1: Get user's channel memberships
    const memberQ = query(
      collection(db, 'channelMembers'),
      where('userId', '==', userId),
    );

    const memberUnsub = onSnapshot(memberQ, async (memberSnap) => {
      // Clean up old channel listeners
      channelUnsubscribes.forEach((unsub) => unsub());
      channelUnsubscribes = [];

      const channelIds = memberSnap.docs.map((d) => d.data().channelId as string);

      if (channelIds.length === 0) return;

      // Step 2: For each channel, listen for new messages
      for (const channelId of channelIds) {
        const msgQ = query(
          collection(db, 'messages'),
          where('channelId', '==', channelId),
        );

        // Track whether this is the initial load (don't notify for existing msgs)
        let isFirstSnapshot = true;

        const unsub = onSnapshot(msgQ, (msgSnap) => {
          if (isFirstSnapshot) {
            isFirstSnapshot = false;
            return; // Skip initial load
          }

          // Process only newly added documents
          for (const change of msgSnap.docChanges()) {
            if (change.type !== 'added') continue;

            const msg = change.doc.data();
            const msgUserId = msg.userId as string;
            const msgBody = msg.body as string;
            const msgCreatedAt = msg.createdAt as Timestamp | null;

            // Skip messages from current user
            if (msgUserId === userId) continue;

            // Skip scheduled messages
            if (msg.isScheduled) continue;

            // Skip messages older than when we started listening
            const msgTime = msgCreatedAt?.toMillis?.() ?? 0;
            if (msgTime > 0 && msgTime < listeningSince.current) continue;

            // Skip if user is currently viewing this channel
            if (activeChannelId.current === channelId) continue;

            // Show browser notification
            void showNotification(channelId, msgUserId, msgBody, msg);
          }
        });

        channelUnsubscribes.push(unsub);
      }
    });

    return () => {
      memberUnsub();
      channelUnsubscribes.forEach((unsub) => unsub());
    };
  }, [userId, profile?.companyId]);

  // Show a browser notification
  async function showNotification(
    channelId: string,
    senderUserId: string,
    body: string,
    msgData: Record<string, unknown>,
  ) {
    // Check if notifications are permitted
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    // Get sender name (cached)
    let senderName = userNameCache.current[senderUserId];
    if (!senderName) {
      try {
        const userDoc = await getDoc(doc(db, 'users', senderUserId));
        if (userDoc.exists()) {
          senderName = (userDoc.data().fullName as string) ?? 'Someone';
        } else {
          senderName = 'Someone';
        }
        userNameCache.current[senderUserId] = senderName;
      } catch {
        senderName = 'Someone';
      }
    }

    // Get channel name
    let channelName = '';
    try {
      const channelDoc = await getDoc(doc(db, 'channels', channelId));
      if (channelDoc.exists()) {
        const channelData = channelDoc.data();
        channelName = (channelData.name as string) ?? '';
      }
    } catch {
      // ignore
    }

    // Determine notification body
    let notifBody = body || '';
    if (msgData.isVoiceMessage) {
      notifBody = '🎙️ Voice message';
    } else if (msgData.attachments && (msgData.attachments as unknown[]).length > 0) {
      notifBody = notifBody || '📎 Attachment';
    }

    const title = channelName ? `${senderName} in ${channelName}` : senderName;

    try {
      // Try using service worker registration for persistent notifications
      const swReg = await navigator.serviceWorker?.getRegistration();
      if (swReg) {
        await swReg.showNotification(title, {
          body: notifBody,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: `msg-${channelId}`, // Collapse notifications per channel
          renotify: true,
          data: {
            channelId,
            url: `/messages?channel=${channelId}`,
          },
        });
      } else {
        // Fallback to basic Notification API
        new Notification(title, {
          body: notifBody,
          icon: '/pwa-192x192.png',
          tag: `msg-${channelId}`,
        });
      }
    } catch (err) {
      console.warn('Failed to show notification:', err);
    }
  }

  return { setActiveChannel };
}
