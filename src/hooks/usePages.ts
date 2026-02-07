import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
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
import type { Page } from '@/types';

// Fetch all pages for a project
export function useProjectPages(projectId: string | undefined) {
  return useQuery({
    queryKey: ['pages', 'project', projectId],
    queryFn: async (): Promise<Page[]> => {
      if (!projectId) return [];

      const q = query(
        collection(db, 'pages'),
        where('projectId', '==', projectId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Page)
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

// Fetch single page by id
export function usePage(id: string | undefined) {
  return useQuery({
    queryKey: ['page', id],
    queryFn: async () => {
      if (!id) return null;
      const docRef = doc(db, 'pages', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as Page;
    },
    enabled: !!id,
  });
}

// Create a page
export function useCreatePage() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      title: string;
      pageType: Page['pageType'];
    }) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const pageData = {
        projectId: data.projectId,
        companyId: profile.companyId,
        title: data.title,
        pageType: data.pageType,
        content: { type: 'doc', content: [] },
        photoIds: [],
        shareToken: crypto.randomUUID(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'pages'), pageData);

      // Log activity
      await logActivity({
        companyId: profile.companyId,
        projectId: data.projectId,
        userId: user.uid,
        activityType: 'page_created',
        message: `${profile.fullName} created page "${data.title}"`,
        entityType: 'page',
        entityId: docRef.id,
      });

      return { id: docRef.id, ...pageData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
  });
}

// Update a page
export function useUpdatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Page> }) => {
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'pages', id), updateData);

      return { id, ...updateData };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      queryClient.invalidateQueries({ queryKey: ['page', id] });
    },
  });
}

// Delete a page
export function useDeletePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pageId: string) => {
      await deleteDoc(doc(db, 'pages', pageId));
      return pageId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
  });
}
