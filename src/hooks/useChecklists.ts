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
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { logActivity } from '@/lib/activityLogger';
import { createNotification } from '@/lib/notifications';
import type { Checklist, ChecklistItem, TemplateSection } from '@/types';

// ============================================================
// Types
// ============================================================

interface ChecklistWithProgress extends Checklist {
  totalItems: number;
  completedItems: number;
}

interface CreateChecklistInput {
  projectId: string;
  name: string;
  templateId?: string;
  assignedTo?: string;
  sections: TemplateSection[];
}

// ============================================================
// Queries
// ============================================================

// Fetch checklists for a project with completion stats
export function useProjectChecklists(projectId: string | undefined) {
  return useQuery({
    queryKey: ['checklists', 'project', projectId],
    queryFn: async (): Promise<ChecklistWithProgress[]> => {
      if (!projectId) return [];

      const q = query(
        collection(db, 'checklists'),
        where('projectId', '==', projectId)
      );

      const snapshot = await getDocs(q);
      const checklists: ChecklistWithProgress[] = [];

      for (const docSnap of snapshot.docs) {
        const checklist = { id: docSnap.id, ...docSnap.data() } as Checklist;

        // Fetch items to compute progress
        const itemsQuery = query(
          collection(db, 'checklistItems'),
          where('checklistId', '==', docSnap.id)
        );
        const itemsSnapshot = await getDocs(itemsQuery);

        const totalItems = itemsSnapshot.size;
        const completedItems = itemsSnapshot.docs.filter(
          (d) => d.data().completed === true
        ).length;

        checklists.push({ ...checklist, totalItems, completedItems });
      }

      checklists.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return checklists;
    },
    enabled: !!projectId,
  });
}

// Fetch checklists assigned to current user across all projects
export function useMyChecklists() {
  const { user } = useAuthContext();
  const userId = user?.uid;

  return useQuery({
    queryKey: ['checklists', 'my', userId],
    queryFn: async (): Promise<ChecklistWithProgress[]> => {
      if (!userId) return [];

      const q = query(
        collection(db, 'checklists'),
        where('assignedTo', '==', userId),
        where('status', '==', 'in_progress')
      );

      const snapshot = await getDocs(q);
      const checklists: ChecklistWithProgress[] = [];

      for (const docSnap of snapshot.docs) {
        const checklist = { id: docSnap.id, ...docSnap.data() } as Checklist;

        // Fetch items to compute progress
        const itemsQuery = query(
          collection(db, 'checklistItems'),
          where('checklistId', '==', docSnap.id)
        );
        const itemsSnapshot = await getDocs(itemsQuery);

        const totalItems = itemsSnapshot.size;
        const completedItems = itemsSnapshot.docs.filter(
          (d) => d.data().completed === true
        ).length;

        checklists.push({ ...checklist, totalItems, completedItems });
      }

      checklists.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return checklists;
    },
    enabled: !!user?.uid,
  });
}

// Fetch single checklist with its items
export function useChecklist(id: string | undefined) {
  return useQuery({
    queryKey: ['checklist', id],
    queryFn: async (): Promise<{ checklist: Checklist; items: ChecklistItem[] } | null> => {
      if (!id) return null;

      const docRef = doc(db, 'checklists', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;

      const checklist = { id: docSnap.id, ...docSnap.data() } as Checklist;

      const itemsQuery = query(
        collection(db, 'checklistItems'),
        where('checklistId', '==', id)
      );
      const itemsSnapshot = await getDocs(itemsQuery);
      const items = itemsSnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ChecklistItem[];
      items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      return { checklist, items };
    },
    enabled: !!id,
  });
}

// ============================================================
// Mutations
// ============================================================

// Create checklist from template or blank
export function useCreateChecklist() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: CreateChecklistInput) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      // Create checklist document
      const checklistData = {
        projectId: data.projectId,
        companyId: profile.companyId,
        templateId: data.templateId || null,
        name: data.name,
        status: 'in_progress' as const,
        assignedTo: data.assignedTo || null,
        sections: data.sections,
        completedAt: null,
        completedBy: null,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'checklists'), checklistData);

      // Flatten sections into checklist items
      const batch = writeBatch(db);
      let sortOrder = 0;

      for (const section of data.sections) {
        for (const field of section.fields) {
          const itemRef = doc(collection(db, 'checklistItems'));
          batch.set(itemRef, {
            checklistId: docRef.id,
            sectionName: section.name,
            label: field.label,
            fieldType: field.type,
            sortOrder,
            completed: false,
            completedAt: null,
            completedBy: null,
            value: null,
            photoIds: [],
            notes: null,
            required: field.required,
            options: field.options || null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          sortOrder++;
        }
      }

      await batch.commit();

      // Log activity
      await logActivity({
        companyId: profile.companyId,
        projectId: data.projectId,
        userId: user.uid,
        activityType: 'checklist_created',
        message: `${profile.fullName} created checklist "${data.name}"`,
        entityType: 'checklist',
        entityId: docRef.id,
      });

      // Notify assigned user if different from creator
      if (data.assignedTo && data.assignedTo !== user.uid) {
        await createNotification({
          userId: data.assignedTo,
          companyId: profile.companyId,
          title: `${profile.fullName} assigned you a checklist`,
          body: `Checklist "${data.name}" has been assigned to you`,
          type: 'checklist_assigned',
          entityType: 'checklist',
          entityId: docRef.id,
          actionUrl: `/projects/${data.projectId}/checklists/${docRef.id}`,
        });
      }

      return { id: docRef.id, ...checklistData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
    },
  });
}

// Update a single checklist item
export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      itemId,
      updates,
    }: {
      itemId: string;
      updates: Partial<ChecklistItem>;
    }) => {
      if (!user?.uid) {
        throw new Error('Not authenticated');
      }

      const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      // If completing the item, set completion metadata
      if (updates.completed === true) {
        updateData.completedAt = serverTimestamp();
        updateData.completedBy = user.uid;
      }

      const docRef = doc(db, 'checklistItems', itemId);
      await updateDoc(docRef, updateData);

      return { id: itemId, ...updateData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist'] });
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
    },
  });
}

// Mark entire checklist as completed
export function useCompleteChecklist() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ checklistId }: { checklistId: string }) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      // Fetch the checklist to get project info
      const checklistRef = doc(db, 'checklists', checklistId);
      const checklistSnap = await getDoc(checklistRef);
      if (!checklistSnap.exists()) {
        throw new Error('Checklist not found');
      }
      const checklist = { id: checklistSnap.id, ...checklistSnap.data() } as Checklist;

      // Update checklist status
      await updateDoc(checklistRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
        completedBy: user.uid,
        updatedAt: serverTimestamp(),
      });

      // Log activity
      await logActivity({
        companyId: profile.companyId,
        projectId: checklist.projectId,
        userId: user.uid,
        activityType: 'checklist_completed',
        message: `${profile.fullName} completed checklist "${checklist.name}"`,
        entityType: 'checklist',
        entityId: checklistId,
      });

      // Notify checklist creator if different from completer
      if (checklist.createdBy && checklist.createdBy !== user.uid) {
        await createNotification({
          userId: checklist.createdBy,
          companyId: profile.companyId,
          title: `${profile.fullName} completed a checklist`,
          body: `Checklist "${checklist.name}" has been completed`,
          type: 'checklist_completed',
          entityType: 'checklist',
          entityId: checklistId,
          actionUrl: `/projects/${checklist.projectId}/checklists/${checklistId}`,
        });
      }

      return { id: checklistId };
    },
    onSuccess: (_, { checklistId }) => {
      queryClient.invalidateQueries({ queryKey: ['checklist', checklistId] });
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
    },
  });
}
