import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { logActivity } from '@/lib/activityLogger';
import type { Showcase } from '@/types';

// Helper: generate a URL-friendly slug from a title
function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}

// Fetch all showcases for the current company
export function useShowcases() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ['showcases', companyId],
    queryFn: async (): Promise<Showcase[]> => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'showcases'),
        where('companyId', '==', companyId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Showcase)
      );
      results.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return results;
    },
    enabled: !!companyId,
  });
}

// Create a new showcase
export function useCreateShowcase() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      projectId,
      title,
      description,
      beforePhotoId,
      afterPhotoId,
      galleryPhotoIds,
    }: {
      projectId: string;
      title: string;
      description?: string;
      beforePhotoId?: string;
      afterPhotoId?: string;
      galleryPhotoIds: string[];
    }) => {
      const companyId = profile!.companyId;

      const docRef = await addDoc(collection(db, 'showcases'), {
        projectId,
        companyId,
        title,
        description: description || null,
        beforePhotoId: beforePhotoId || null,
        afterPhotoId: afterPhotoId || null,
        galleryPhotoIds,
        isPublished: false,
        slug: null,
        createdBy: user!.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Log activity
      await logActivity({
        companyId: companyId!,
        projectId,
        userId: user!.uid,
        activityType: 'gallery_created',
        message: `${profile!.fullName} created showcase "${title}"`,
        metadata: { showcaseId: docRef.id },
      });

      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcases'] });
    },
  });
}

// Update an existing showcase
export function useUpdateShowcase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Showcase>;
    }) => {
      const docRef = doc(db, 'showcases', id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcases'] });
    },
  });
}

// Delete a showcase
export function useDeleteShowcase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const docRef = doc(db, 'showcases', id);
      await deleteDoc(docRef);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcases'] });
    },
  });
}

// Publish a showcase: set isPublished=true and generate slug
export function usePublishShowcase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const slug = generateSlug(title);
      const docRef = doc(db, 'showcases', id);
      await updateDoc(docRef, {
        isPublished: true,
        slug,
        updatedAt: serverTimestamp(),
      });
      return slug;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcases'] });
    },
  });
}

// Unpublish a showcase: set isPublished=false
export function useUnpublishShowcase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const docRef = doc(db, 'showcases', id);
      await updateDoc(docRef, {
        isPublished: false,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['showcases'] });
    },
  });
}
