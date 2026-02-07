import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import type { TimeOffRequest, TimeOffRequestStatus } from '@/types';

// Fetch my time-off requests
export function useMyTimeOffRequests() {
  const { user, profile } = useAuthContext();
  return useQuery({
    queryKey: ['timeOffRequests', 'my', user?.uid],
    queryFn: async () => {
      if (!user?.uid || !profile?.companyId) return [];
      const q = query(
        collection(db, 'timeOffRequests'),
        where('userId', '==', user.uid),
        where('companyId', '==', profile.companyId),
      );
      const snap = await getDocs(q);
      const results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimeOffRequest));
      results.sort((a, b) => {
        const aTime = (a.startDate as any)?.toDate?.()?.getTime?.() || (typeof a.startDate === 'string' ? new Date(a.startDate).getTime() : 0);
        const bTime = (b.startDate as any)?.toDate?.()?.getTime?.() || (typeof b.startDate === 'string' ? new Date(b.startDate).getTime() : 0);
        return bTime - aTime;
      });
      return results;
    },
    enabled: !!user?.uid && !!profile?.companyId,
  });
}

// Fetch all company time-off requests (admin)
export function useAllTimeOffRequests() {
  const { profile } = useAuthContext();
  return useQuery({
    queryKey: ['timeOffRequests', 'all', profile?.companyId],
    queryFn: async () => {
      if (!profile?.companyId) return [];
      const q = query(
        collection(db, 'timeOffRequests'),
        where('companyId', '==', profile.companyId),
      );
      const snap = await getDocs(q);
      const results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimeOffRequest));
      results.sort((a, b) => {
        const aTime = (a.startDate as any)?.toDate?.()?.getTime?.() || (typeof a.startDate === 'string' ? new Date(a.startDate).getTime() : 0);
        const bTime = (b.startDate as any)?.toDate?.()?.getTime?.() || (typeof b.startDate === 'string' ? new Date(b.startDate).getTime() : 0);
        return bTime - aTime;
      });
      return results;
    },
    enabled: !!profile?.companyId,
  });
}

// Create time-off request
export function useCreateTimeOffRequest() {
  const queryClient = useQueryClient();
  const { user, profile } = useAuthContext();
  return useMutation({
    mutationFn: async (data: {
      type: TimeOffRequest['type'];
      startDate: string;
      endDate: string;
      reason: string;
    }) => {
      if (!user?.uid || !profile?.companyId) throw new Error('Not authenticated');
      const docRef = await addDoc(collection(db, 'timeOffRequests'), {
        ...data,
        companyId: profile.companyId,
        userId: user.uid,
        status: 'pending' as TimeOffRequestStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { id: docRef.id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeOffRequests'] });
    },
  });
}

// Review (approve/deny) a time-off request
export function useReviewTimeOffRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      reviewNote,
    }: {
      id: string;
      status: 'approved' | 'denied';
      reviewNote?: string;
    }) => {
      if (!user?.uid) throw new Error('Not authenticated');
      await updateDoc(doc(db, 'timeOffRequests', id), {
        status,
        reviewedBy: user.uid,
        reviewedAt: serverTimestamp(),
        reviewNote: reviewNote ?? '',
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeOffRequests'] });
    },
  });
}
