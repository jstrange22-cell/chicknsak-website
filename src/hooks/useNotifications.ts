import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { useEffect } from 'react';
import { db } from '@/lib/firebase';
import type { Notification } from '@/types';

// Fetch paginated notifications
export function useNotifications(userId: string | undefined, pageLimit = 50) {
  return useQuery({
    queryKey: ['notifications', userId, pageLimit],
    queryFn: async (): Promise<Notification[]> => {
      if (!userId) return [];

      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Notification)
      );
      results.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return results.slice(0, pageLimit);
    },
    enabled: !!userId,
  });
}

// Unread count
export function useUnreadCount(userId: string | undefined) {
  const queryClient = useQueryClient();

  const result = useQuery({
    queryKey: ['unreadCount', userId],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;

      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    },
    enabled: !!userId,
  });

  // Real-time listener for new notifications
  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );

    const unsubscribe = onSnapshot(q, () => {
      queryClient.invalidateQueries({ queryKey: ['unreadCount', userId] });
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    });

    return () => unsubscribe();
  }, [userId, queryClient]);

  return result;
}

// Mark single notification as read
export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const docRef = doc(db, 'notifications', notificationId);
      await updateDoc(docRef, {
        isRead: true,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
}

// Mark all as read
export function useMarkAllRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          isRead: true,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
}
