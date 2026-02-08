import { useState, useEffect, useCallback } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import type { MessagePayload } from 'firebase/messaging';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db, messagingPromise } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

interface UsePushNotificationsReturn {
  /** Request permission and register the FCM token */
  requestPermission: () => Promise<void>;
  /** Whether the browser supports push notifications */
  isSupported: boolean;
  /** Current permission status */
  permissionStatus: PermissionStatus;
  /** Whether the permission request is in progress */
  isRequesting: boolean;
  /** Error message if registration failed */
  error: string | null;
}

// ---------------------------------------------------------------------------
// VAPID key — should be set in .env as VITE_FIREBASE_VAPID_KEY
// ---------------------------------------------------------------------------

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePushNotifications(): UsePushNotificationsReturn {
  const { user } = useAuthContext();
  const [isSupported, setIsSupported] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('default');
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check support on mount
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const messaging = await messagingPromise;
        if (!cancelled) {
          setIsSupported(messaging !== null);
          if (messaging === null) {
            setPermissionStatus('unsupported');
          } else if (typeof Notification !== 'undefined') {
            setPermissionStatus(Notification.permission as PermissionStatus);
          }
        }
      } catch {
        if (!cancelled) {
          setIsSupported(false);
          setPermissionStatus('unsupported');
        }
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for foreground messages when permission is granted
  useEffect(() => {
    if (permissionStatus !== 'granted') return;

    let unsubscribe: (() => void) | undefined;

    async function subscribe() {
      const messaging = await messagingPromise;
      if (!messaging) return;

      unsubscribe = onMessage(messaging, (payload: MessagePayload) => {
        // Show a browser notification for foreground messages
        const title = payload.notification?.title ?? 'New Message';
        const body = payload.notification?.body ?? '';

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/pwa-192x192.png',
            data: payload.data,
          });
        }
      });
    }

    void subscribe();
    return () => {
      unsubscribe?.();
    };
  }, [permissionStatus]);

  // Store token in Firestore
  const storeToken = useCallback(
    async (token: string) => {
      if (!user?.uid) return;

      const tokenDocRef = doc(
        collection(db, `users/${user.uid}/fcmTokens`),
        token,
      );
      await setDoc(tokenDocRef, {
        token,
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent,
      });
    },
    [user?.uid],
  );

  // Clean up stale tokens
  const cleanupStaleTokens = useCallback(
    async (currentToken: string) => {
      if (!user?.uid) return;

      const tokensRef = collection(db, `users/${user.uid}/fcmTokens`);
      const snap = await getDocs(query(tokensRef, where('token', '!=', currentToken)));

      // Remove tokens older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const tokenDoc of snap.docs) {
        const data = tokenDoc.data();
        const createdAt = data.createdAt?.toDate?.();
        if (createdAt && createdAt < thirtyDaysAgo) {
          await deleteDoc(tokenDoc.ref);
        }
      }
    },
    [user?.uid],
  );

  // Request permission and register token
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      setError('Push notifications are not supported in this browser.');
      return;
    }

    setIsRequesting(true);
    setError(null);

    try {
      const messaging = await messagingPromise;
      if (!messaging) {
        setError('Firebase Messaging is not available.');
        return;
      }

      // Request browser notification permission
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission as PermissionStatus);

      if (permission !== 'granted') {
        setError('Notification permission was denied.');
        return;
      }

      // Register the FCM service worker if not already registered
      let swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (!swRegistration) {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      }

      // Get FCM token
      const tokenOptions: { serviceWorkerRegistration: ServiceWorkerRegistration; vapidKey?: string } = {
        serviceWorkerRegistration: swRegistration,
      };
      if (VAPID_KEY) {
        tokenOptions.vapidKey = VAPID_KEY;
      }
      const token = await getToken(messaging, tokenOptions);

      if (!token) {
        setError('Failed to get notification token.');
        return;
      }

      // Store in Firestore
      await storeToken(token);
      await cleanupStaleTokens(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enable push notifications.';
      setError(message);
      console.error('Push notification registration error:', err);
    } finally {
      setIsRequesting(false);
    }
  }, [isSupported, storeToken, cleanupStaleTokens]);

  return {
    requestPermission,
    isSupported,
    permissionStatus,
    isRequesting,
    error,
  };
}
