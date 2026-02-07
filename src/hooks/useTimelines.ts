import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import type { Timeline } from '@/types';

// Fetch timeline for a project (returns single or null)
export function useProjectTimeline(projectId: string | undefined) {
  return useQuery({
    queryKey: ['timeline', projectId],
    queryFn: async (): Promise<Timeline | null> => {
      if (!projectId) return null;

      const q = query(
        collection(db, 'timelines'),
        where('projectId', '==', projectId)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      // If multiple docs exist, return the first one
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as Timeline;
    },
    enabled: !!projectId,
  });
}

// Create a timeline
export function useCreateTimeline() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      projectId,
    }: {
      projectId: string;
    }) => {
      const companyId = profile!.companyId;

      const docRef = await addDoc(collection(db, 'timelines'), {
        projectId,
        companyId,
        shareToken: crypto.randomUUID(),
        isActive: true,
        allowComments: false,
        createdBy: user!.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

// Update a timeline
export function useUpdateTimeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Timeline>;
    }) => {
      const docRef = doc(db, 'timelines', id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}
