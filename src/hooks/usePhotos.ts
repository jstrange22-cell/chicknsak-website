import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  startAfter,
  DocumentSnapshot,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { Photo, PhotoTag } from '@/types';
import { logActivity } from '@/lib/activityLogger';

interface UsePhotosOptions {
  projectId?: string;
  companyId?: string;
  tagIds?: string[];
  limit?: number;
  cursor?: DocumentSnapshot;
}

interface PhotoWithTags extends Photo {
  tags: PhotoTag[];
}

// Fetch photos with filters
export function usePhotos(options: UsePhotosOptions = {}) {
  return useQuery({
    queryKey: ['photos', options],
    queryFn: async (): Promise<PhotoWithTags[]> => {
      let q = query(collection(db, 'photos'));

      if (options.projectId) {
        q = query(q, where('projectId', '==', options.projectId));
      }

      if (options.companyId) {
        q = query(q, where('companyId', '==', options.companyId));
      }

      if (options.cursor) {
        q = query(q, startAfter(options.cursor));
      }

      const snapshot = await getDocs(q);
      const photos: PhotoWithTags[] = [];

      for (const docSnap of snapshot.docs) {
        const photoData = { id: docSnap.id, ...docSnap.data() } as Photo;

        // Fetch tags for this photo
        const tagsQuery = query(
          collection(db, 'photoTags'),
          where('photoId', '==', docSnap.id)
        );
        const tagsSnapshot = await getDocs(tagsQuery);
        const tags = tagsSnapshot.docs.map(
          (tagDoc) => ({ id: tagDoc.id, ...tagDoc.data() } as PhotoTag)
        );

        photos.push({ ...photoData, tags });
      }

      // Sort by capturedAt descending (client-side replacement for orderBy)
      photos.sort((a, b) => {
        const aTime = (a.capturedAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.capturedAt as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });

      // Apply limit client-side
      let result = options.limit ? photos.slice(0, options.limit) : photos;

      // Filter by tags if specified
      if (options.tagIds && options.tagIds.length > 0) {
        result = result.filter((photo) =>
          photo.tags.some((tag) => options.tagIds!.includes(tag.tagId))
        );
      }

      return result;
    },
    enabled: !!(options.projectId || options.companyId),
  });
}

// Fetch single photo
export function usePhoto(photoId: string | undefined) {
  return useQuery({
    queryKey: ['photo', photoId],
    queryFn: async (): Promise<PhotoWithTags | null> => {
      if (!photoId) return null;

      const docRef = doc(db, 'photos', photoId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const photoData = { id: docSnap.id, ...docSnap.data() } as Photo;

      // Fetch tags
      const tagsQuery = query(
        collection(db, 'photoTags'),
        where('photoId', '==', photoId)
      );
      const tagsSnapshot = await getDocs(tagsQuery);
      const tags = tagsSnapshot.docs.map(
        (tagDoc) => ({ id: tagDoc.id, ...tagDoc.data() } as PhotoTag)
      );

      return { ...photoData, tags };
    },
    enabled: !!photoId,
  });
}

// Update photo
export function useUpdatePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      photoId,
      updates,
    }: {
      photoId: string;
      updates: Partial<Photo>;
    }) => {
      const docRef = doc(db, 'photos', photoId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      queryClient.invalidateQueries({ queryKey: ['photo', variables.photoId] });
    },
  });
}

// Delete photo
export function useDeletePhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      photoId,
      userId,
      companyId,
    }: {
      photoId: string;
      userId: string;
      companyId: string;
    }) => {
      // Get photo data first
      const photoRef = doc(db, 'photos', photoId);
      const photoSnap = await getDoc(photoRef);

      if (!photoSnap.exists()) {
        throw new Error('Photo not found');
      }

      const photoData = photoSnap.data() as Photo;

      // Delete files from storage
      if (photoData.storagePath) {
        const fileRef = ref(storage, photoData.storagePath);
        await deleteObject(fileRef).catch(() => {
          // Ignore if file doesn't exist
        });
      }

      if (photoData.thumbnailPath) {
        const thumbRef = ref(storage, photoData.thumbnailPath);
        await deleteObject(thumbRef).catch(() => {
          // Ignore if file doesn't exist
        });
      }

      // Delete photo tags
      const tagsQuery = query(
        collection(db, 'photoTags'),
        where('photoId', '==', photoId)
      );
      const tagsSnapshot = await getDocs(tagsQuery);
      for (const tagDoc of tagsSnapshot.docs) {
        await deleteDoc(tagDoc.ref);
      }

      // Delete photo comments
      const commentsQuery = query(
        collection(db, 'comments'),
        where('photoId', '==', photoId)
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      for (const commentDoc of commentsSnapshot.docs) {
        await deleteDoc(commentDoc.ref);
      }

      // Delete the photo document
      await deleteDoc(photoRef);

      // Log activity
      await logActivity({
        companyId,
        projectId: photoData.projectId,
        userId,
        activityType: 'photo_deleted',
        message: 'Photo deleted',
        metadata: { photoId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// Add tag to photo
export function useAddPhotoTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      photoId,
      tagId,
    }: {
      photoId: string;
      tagId: string;
    }) => {
      const { addDoc, collection: col } = await import('firebase/firestore');
      await addDoc(col(db, 'photoTags'), {
        photoId,
        tagId,
        createdAt: serverTimestamp(),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      queryClient.invalidateQueries({ queryKey: ['photo', variables.photoId] });
    },
  });
}

// Remove tag from photo
export function useRemovePhotoTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      photoId,
      tagId,
    }: {
      photoId: string;
      tagId: string;
    }) => {
      const tagsQuery = query(
        collection(db, 'photoTags'),
        where('photoId', '==', photoId),
        where('tagId', '==', tagId)
      );
      const snapshot = await getDocs(tagsQuery);
      for (const tagDoc of snapshot.docs) {
        await deleteDoc(tagDoc.ref);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
      queryClient.invalidateQueries({ queryKey: ['photo', variables.photoId] });
    },
  });
}
