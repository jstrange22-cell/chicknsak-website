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
import type { ReviewRequest } from '@/types';

// Fetch all review requests for the current company
export function useReviewRequests() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ['reviewRequests', companyId],
    queryFn: async (): Promise<ReviewRequest[]> => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'reviewRequests'),
        where('companyId', '==', companyId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as ReviewRequest)
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

// Fetch review requests for a specific project
export function useProjectReviewRequests(projectId: string | undefined) {
  return useQuery({
    queryKey: ['reviewRequests', 'project', projectId],
    queryFn: async (): Promise<ReviewRequest[]> => {
      if (!projectId) return [];

      const q = query(
        collection(db, 'reviewRequests'),
        where('projectId', '==', projectId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as ReviewRequest)
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

// Create a new review request
export function useCreateReviewRequest() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      projectId,
      customerName,
      customerEmail,
      customerPhone,
      platform,
      reviewLink,
      message,
      status,
    }: {
      projectId: string;
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      platform?: ReviewRequest['platform'];
      reviewLink?: string;
      message?: string;
      status: ReviewRequest['status'];
    }) => {
      const companyId = profile!.companyId;

      const docData: Record<string, unknown> = {
        projectId,
        companyId,
        customerName,
        customerEmail: customerEmail || null,
        customerPhone: customerPhone || null,
        platform: platform || null,
        reviewLink: reviewLink || null,
        message: message || null,
        status,
        sentAt: status === 'sent' ? serverTimestamp() : null,
        createdBy: user!.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'reviewRequests'), docData);
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewRequests'] });
    },
  });
}

// Update a review request (status, message, etc.)
export function useUpdateReviewRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ReviewRequest>;
    }) => {
      const docRef = doc(db, 'reviewRequests', id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewRequests'] });
    },
  });
}

// Send a review request: update status to 'sent' and set sentAt
export function useSendReviewRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const docRef = doc(db, 'reviewRequests', id);
      await updateDoc(docRef, {
        status: 'sent',
        sentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewRequests'] });
    },
  });
}
