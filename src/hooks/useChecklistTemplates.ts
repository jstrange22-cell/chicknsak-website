import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import type { ChecklistTemplate, UpdateData } from '@/types';
import { logActivity } from '@/lib/activityLogger';

// Fetch all active checklist templates for current company
export function useChecklistTemplates() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ['checklistTemplates', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'checklistTemplates'),
        where('companyId', '==', companyId),
        where('isActive', '==', true)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as ChecklistTemplate)
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

// Fetch single checklist template by id
export function useChecklistTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['checklistTemplate', id],
    queryFn: async () => {
      if (!id) return null;
      const docRef = doc(db, 'checklistTemplates', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as ChecklistTemplate;
    },
    enabled: !!id,
  });
}

// Input type for creating a template
type CreateTemplateInput = Omit<ChecklistTemplate, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'createdBy' | 'isActive'>;

// Create checklist template mutation
export function useCreateTemplate() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: CreateTemplateInput) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const templateData = {
        ...data,
        companyId: profile.companyId,
        createdBy: user.uid,
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'checklistTemplates'), templateData);

      // Log activity
      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'checklist_created',
        message: `${profile.fullName} created template "${data.name}"`,
        entityType: 'checklistTemplate',
        entityId: docRef.id,
      });

      return { id: docRef.id, ...templateData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] });
    },
  });
}

// Update checklist template mutation
export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateData<ChecklistTemplate> }) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'checklistTemplates', id), updateData);

      return { id, ...updateData };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['checklistTemplate', id] });
    },
  });
}

// Soft delete checklist template (set isActive to false)
export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      await updateDoc(doc(db, 'checklistTemplates', id), {
        isActive: false,
        updatedAt: serverTimestamp(),
      });

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklistTemplates'] });
    },
  });
}

// Default templates to seed on company creation
export const DEFAULT_TEMPLATES: Omit<ChecklistTemplate, 'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'createdBy'>[] = [
  {
    name: 'Pre-Construction Inspection',
    description: 'Complete before starting any construction work on site',
    category: 'inspection',
    isActive: true,
    sections: [
      {
        name: 'Site Conditions',
        fields: [
          { id: 'field_1', label: 'Photos of site', type: 'photo_required', required: true },
          { id: 'field_2', label: 'Access clear', type: 'yes_no', required: true },
          { id: 'field_3', label: 'Utilities marked', type: 'yes_no', required: true },
        ],
      },
      {
        name: 'Measurements',
        fields: [
          { id: 'field_4', label: 'Deck dimensions', type: 'text', required: true },
          { id: 'field_5', label: 'Post locations', type: 'photo_required', required: true },
          { id: 'field_6', label: 'Grade/slope', type: 'text', required: false },
        ],
      },
    ],
  },
  {
    name: 'Daily Safety Checklist',
    description: 'Daily safety verification before work begins',
    category: 'safety',
    isActive: true,
    sections: [
      {
        name: 'PPE',
        fields: [
          { id: 'field_1', label: 'Hard hats', type: 'checkbox', required: true },
          { id: 'field_2', label: 'Safety glasses', type: 'checkbox', required: true },
          { id: 'field_3', label: 'Gloves', type: 'checkbox', required: true },
        ],
      },
      {
        name: 'Site Safety',
        fields: [
          { id: 'field_4', label: 'Fall protection', type: 'yes_no', required: true },
          { id: 'field_5', label: 'Fire extinguisher', type: 'yes_no', required: true },
          { id: 'field_6', label: 'First aid kit', type: 'yes_no', required: true },
        ],
      },
    ],
  },
  {
    name: 'Final Walkthrough',
    description: 'Quality check and client sign-off on completed work',
    category: 'quality',
    isActive: true,
    sections: [
      {
        name: 'Structure',
        fields: [
          { id: 'field_1', label: 'Posts plumb', type: 'yes_no', required: true },
          { id: 'field_2', label: 'Beams level', type: 'yes_no', required: true },
          { id: 'field_3', label: 'Fasteners correct', type: 'yes_no', required: true },
        ],
      },
      {
        name: 'Finish',
        fields: [
          { id: 'field_4', label: 'Stain/seal applied', type: 'photo_required', required: true },
          { id: 'field_5', label: 'Hardware installed', type: 'photo_required', required: true },
          { id: 'field_6', label: 'Client sign-off', type: 'signature', required: true },
        ],
      },
    ],
  },
];
