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
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Label, LabelGroup } from '@/types';

// Fetch all labels for a company
export function useLabels(companyId: string | undefined) {
  return useQuery({
    queryKey: ['labels', companyId],
    queryFn: async (): Promise<Label[]> => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'labels'),
        where('companyId', '==', companyId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Label)
      );
      results.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      return results;
    },
    enabled: !!companyId,
  });
}

// Create a new label
export function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      name,
      color,
      labelGroup,
      sortOrder,
    }: {
      companyId: string;
      name: string;
      color: string;
      labelGroup: LabelGroup;
      sortOrder?: number;
    }) => {
      const docRef = await addDoc(collection(db, 'labels'), {
        companyId,
        name,
        color,
        labelGroup,
        sortOrder: sortOrder ?? 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['labels', variables.companyId] });
    },
  });
}

// Update a label
export function useUpdateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      labelId,
      updates,
    }: {
      labelId: string;
      updates: Partial<Pick<Label, 'name' | 'color' | 'labelGroup' | 'sortOrder'>>;
    }) => {
      const docRef = doc(db, 'labels', labelId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}

// Delete a label
export function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ labelId }: { labelId: string }) => {
      const docRef = doc(db, 'labels', labelId);
      await deleteDoc(docRef);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });
}

// Default labels to seed on company creation
export const DEFAULT_LABELS: { name: string; color: string; labelGroup: LabelGroup }[] = [
  { name: 'Active', color: '#10B981', labelGroup: 'status' },
  { name: 'On Hold', color: '#F59E0B', labelGroup: 'status' },
  { name: 'Completed', color: '#3B82F6', labelGroup: 'status' },
];

export const LABEL_GROUP_LABELS: Record<LabelGroup, string> = {
  status: 'Status',
  type: 'Type',
  source: 'Source',
  priority: 'Priority',
  custom: 'Custom',
};
