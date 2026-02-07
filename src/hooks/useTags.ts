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
import type { Tag } from '@/types';

// Fetch all tags for a company
export function useTags(companyId: string | undefined) {
  return useQuery({
    queryKey: ['tags', companyId],
    queryFn: async (): Promise<Tag[]> => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'tags'),
        where('companyId', '==', companyId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Tag)
      );
      results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return results;
    },
    enabled: !!companyId,
  });
}

// Create a new tag
export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      companyId,
      name,
      color,
    }: {
      companyId: string;
      name: string;
      color: string;
    }) => {
      const docRef = await addDoc(collection(db, 'tags'), {
        companyId,
        name,
        color,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tags', variables.companyId] });
    },
  });
}

// Update a tag
export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tagId,
      updates,
    }: {
      tagId: string;
      updates: Partial<Pick<Tag, 'name' | 'color'>>;
    }) => {
      const docRef = doc(db, 'tags', tagId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

// Delete a tag
export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tagId }: { tagId: string }) => {
      // Delete all photo-tag associations first
      const photoTagsQuery = query(
        collection(db, 'photoTags'),
        where('tagId', '==', tagId)
      );
      const photoTagsSnapshot = await getDocs(photoTagsQuery);
      for (const photoTagDoc of photoTagsSnapshot.docs) {
        await deleteDoc(photoTagDoc.ref);
      }

      // Delete the tag
      const docRef = doc(db, 'tags', tagId);
      await deleteDoc(docRef);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });
}

// Default tag colors
export const TAG_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#EAB308', // Yellow
  '#84CC16', // Lime
  '#22C55E', // Green
  '#10B981', // Emerald
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#0EA5E9', // Sky
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#D946EF', // Fuchsia
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#78716C', // Stone
];
