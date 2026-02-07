import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Comment, User as UserType } from '@/types';
import { logActivity } from '@/lib/activityLogger';
import { notifyMentions, notifyPhotoComment } from '@/lib/notifications';

interface CommentWithUser extends Comment {
  user?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
}

// Fetch comments for a photo
export function useComments(photoId: string | undefined) {
  return useQuery({
    queryKey: ['comments', photoId],
    queryFn: async (): Promise<CommentWithUser[]> => {
      if (!photoId) return [];

      const q = query(
        collection(db, 'comments'),
        where('photoId', '==', photoId)
      );

      const snapshot = await getDocs(q);
      const comments: CommentWithUser[] = [];

      for (const docSnap of snapshot.docs) {
        const commentData = { id: docSnap.id, ...docSnap.data() } as Comment;

        // Fetch user info
        let user: CommentWithUser['user'];
        try {
          const userDoc = await getDoc(doc(db, 'users', commentData.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserType;
            user = {
              id: userDoc.id,
              fullName: userData.fullName,
              avatarUrl: userData.avatarUrl,
            };
          }
        } catch {
          // User not found, continue without user info
        }

        comments.push({ ...commentData, user });
      }

      comments.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return aTime - bTime;
      });
      return comments;
    },
    enabled: !!photoId,
  });
}

// Create a comment
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      photoId,
      userId,
      companyId,
      projectId,
      content,
      mentions,
      coordinates,
    }: {
      photoId: string;
      userId: string;
      companyId: string;
      projectId: string;
      content: string;
      mentions?: string[];
      coordinates?: { x: number; y: number };
    }) => {
      const docRef = await addDoc(collection(db, 'comments'), {
        photoId,
        userId,
        content,
        mentions: mentions || [],
        coordinates: coordinates || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Log activity
      await logActivity({
        companyId,
        projectId,
        userId,
        activityType: 'comment_added',
        message: 'Comment added to photo',
        metadata: { photoId, commentId: docRef.id },
      });

      // Send notifications to mentioned users
      if (mentions && mentions.length > 0) {
        // Fetch commenter name for notification
        const userDoc = await getDoc(doc(db, 'users', userId));
        const commenterName = userDoc.exists()
          ? (userDoc.data() as UserType).fullName
          : 'Someone';

        await notifyMentions({
          mentionedUserIds: mentions,
          companyId,
          mentionerName: commenterName,
          photoId,
          projectId,
        });
      }

      // Notify photo owner about the comment
      const photoDoc = await getDoc(doc(db, 'photos', photoId));
      if (photoDoc.exists()) {
        const photoData = photoDoc.data();
        const userDoc = await getDoc(doc(db, 'users', userId));
        const commenterName = userDoc.exists()
          ? (userDoc.data() as UserType).fullName
          : 'Someone';

        await notifyPhotoComment({
          photoOwnerId: photoData.uploadedBy || photoData.userId,
          commenterId: userId,
          commenterName,
          companyId,
          photoId,
          projectId,
        });
      }

      return docRef.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.photoId] });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });
}

// Update a comment
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
      content,
      mentions,
    }: {
      commentId: string;
      content: string;
      mentions?: string[];
    }) => {
      const docRef = doc(db, 'comments', commentId);
      await updateDoc(docRef, {
        content,
        mentions: mentions || [],
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}

// Delete a comment
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
    }: {
      commentId: string;
      photoId: string;
    }) => {
      const docRef = doc(db, 'comments', commentId);
      await deleteDoc(docRef);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comments', variables.photoId] });
    },
  });
}

// Fetch comment count for a photo
export function useCommentCount(photoId: string | undefined) {
  return useQuery({
    queryKey: ['commentCount', photoId],
    queryFn: async (): Promise<number> => {
      if (!photoId) return 0;

      const q = query(
        collection(db, 'comments'),
        where('photoId', '==', photoId)
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    },
    enabled: !!photoId,
  });
}
