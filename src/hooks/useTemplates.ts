// Template management hooks for Project Templates, Report Templates,
// and re-export of existing Checklist Template hooks.

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
import type { ProjectTemplate, ReportTemplate, UpdateData } from '@/types';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const PROJECT_TEMPLATES_KEY = 'projectTemplates';
const REPORT_TEMPLATES_KEY = 'reportTemplates';

// ============================================================
// PROJECT TEMPLATES
// ============================================================

/** Fetch all project templates for the current company. */
export function useProjectTemplates() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: [PROJECT_TEMPLATES_KEY, companyId],
    queryFn: async (): Promise<ProjectTemplate[]> => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'projectTemplates'),
        where('companyId', '==', companyId),
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ProjectTemplate,
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

type CreateProjectTemplateInput = Omit<
  ProjectTemplate,
  'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'createdBy'
>;

/** Create a new project template. */
export function useCreateProjectTemplate() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: CreateProjectTemplateInput) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const templateData = {
        ...data,
        companyId: profile.companyId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'projectTemplates'), templateData);
      return { id: docRef.id, ...templateData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_TEMPLATES_KEY] });
    },
  });
}

/** Update an existing project template. */
export function useUpdateProjectTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateData<ProjectTemplate> }) => {
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'projectTemplates', id), updateData);
      return { id, ...updateData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_TEMPLATES_KEY] });
    },
  });
}

/** Delete a project template. */
export function useDeleteProjectTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'projectTemplates', id));
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECT_TEMPLATES_KEY] });
    },
  });
}

// ============================================================
// REPORT TEMPLATES
// ============================================================

/** Fetch all report templates for the current company. */
export function useReportTemplates() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: [REPORT_TEMPLATES_KEY, companyId],
    queryFn: async (): Promise<ReportTemplate[]> => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'reportTemplates'),
        where('companyId', '==', companyId),
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ReportTemplate,
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

type CreateReportTemplateInput = Omit<
  ReportTemplate,
  'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'createdBy'
>;

/** Create a new report template. */
export function useCreateReportTemplate() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: CreateReportTemplateInput) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const templateData = {
        ...data,
        companyId: profile.companyId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'reportTemplates'), templateData);
      return { id: docRef.id, ...templateData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REPORT_TEMPLATES_KEY] });
    },
  });
}

/** Update an existing report template. */
export function useUpdateReportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateData<ReportTemplate> }) => {
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'reportTemplates', id), updateData);
      return { id, ...updateData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REPORT_TEMPLATES_KEY] });
    },
  });
}

/** Delete a report template. */
export function useDeleteReportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'reportTemplates', id));
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REPORT_TEMPLATES_KEY] });
    },
  });
}
