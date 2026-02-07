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
import type { Gallery } from '@/types';

// Fetch galleries for a project
export function useProjectGalleries(projectId: string | undefined) {
  return useQuery({
    queryKey: ['galleries', projectId],
    queryFn: async (): Promise<Gallery[]> => {
      if (!projectId) return [];

      const q = query(
        collection(db, 'galleries'),
        where('projectId', '==', projectId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Gallery)
      );
      results.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return results;
    },
    enabled: !!projectId,
  });
}

// Create a gallery
export function useCreateGallery() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      projectId,
      name,
      description,
      photoIds,
    }: {
      projectId: string;
      name: string;
      description?: string;
      photoIds: string[];
    }) => {
      const companyId = profile!.companyId;

      const docRef = await addDoc(collection(db, 'galleries'), {
        projectId,
        companyId,
        name,
        description: description || null,
        photoIds,
        shareToken: crypto.randomUUID(),
        isActive: true,
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
        message: `${profile!.fullName} created gallery "${name}"`,
        metadata: { galleryId: docRef.id },
      });

      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });
}

// Update a gallery
export function useUpdateGallery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Gallery>;
    }) => {
      const docRef = doc(db, 'galleries', id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });
}

// Delete a gallery
export function useDeleteGallery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const docRef = doc(db, 'galleries', id);
      await deleteDoc(docRef);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['galleries'] });
    },
  });
}
