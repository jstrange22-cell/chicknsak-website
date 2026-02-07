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
import type { Report } from '@/types';

// Fetch all reports for a project
export function useProjectReports(projectId: string | undefined) {
  return useQuery({
    queryKey: ['reports', 'project', projectId],
    queryFn: async (): Promise<Report[]> => {
      if (!projectId) return [];

      const q = query(
        collection(db, 'reports'),
        where('projectId', '==', projectId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Report)
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

// Fetch single report by id
export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: ['report', id],
    queryFn: async () => {
      if (!id) return null;
      const docRef = doc(db, 'reports', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as Report;
    },
    enabled: !!id,
  });
}

// Create a draft report
export function useCreateReport() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      name: string;
      reportType: Report['reportType'];
      coverTitle?: string;
      includeLogo?: boolean;
    }) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const reportData = {
        projectId: data.projectId,
        companyId: profile.companyId,
        name: data.name,
        reportType: data.reportType,
        coverTitle: data.coverTitle || null,
        includeLogo: data.includeLogo ?? true,
        sections: [],
        status: 'draft' as const,
        shareToken: crypto.randomUUID(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'reports'), reportData);

      // Log activity
      await logActivity({
        companyId: profile.companyId,
        projectId: data.projectId,
        userId: user.uid,
        activityType: 'report_created',
        message: `${profile.fullName} created report "${data.name}"`,
        entityType: 'report',
        entityId: docRef.id,
      });

      return { id: docRef.id, ...reportData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

// Update a report
export function useUpdateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Report> }) => {
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'reports', id), updateData);

      return { id, ...updateData };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['report', id] });
    },
  });
}

// Publish a report
export function usePublishReport() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ reportId }: { reportId: string }) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      await updateDoc(doc(db, 'reports', reportId), {
        status: 'published',
        updatedAt: serverTimestamp(),
      });

      // Log activity
      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'report_published',
        message: `${profile.fullName} published a report`,
        entityType: 'report',
        entityId: reportId,
      });

      return reportId;
    },
    onSuccess: (reportId) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['report', reportId] });
    },
  });
}

// Delete a report
export function useDeleteReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string) => {
      await deleteDoc(doc(db, 'reports', reportId));
      return reportId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
