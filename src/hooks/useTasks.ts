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
import { logActivity } from '@/lib/activityLogger';
import { createNotification } from '@/lib/notifications';
import type { Task } from '@/types';

interface TaskFilters {
  status?: string;
}

// Fetch tasks for a project with optional status filter
export function useProjectTasks(projectId: string | undefined, filters?: TaskFilters) {
  return useQuery({
    queryKey: ['tasks', 'project', projectId, filters],
    queryFn: async () => {
      if (!projectId) return [];

      const q = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId)
      );

      const snapshot = await getDocs(q);

      let tasks = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Task[];

      tasks.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });

      // Client-side filter by status
      if (filters?.status) {
        tasks = tasks.filter((t) => t.status === filters.status);
      }

      return tasks;
    },
    enabled: !!projectId,
  });
}

// Fetch tasks assigned to current user (incomplete only)
export function useMyTasks() {
  const { user } = useAuthContext();
  const userId = user?.uid;

  return useQuery({
    queryKey: ['tasks', 'my', userId],
    queryFn: async () => {
      if (!userId) return [];

      const q = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', userId)
      );

      const snapshot = await getDocs(q);

      const tasks = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
        }) as Task)
        .filter((t) => t.status !== 'completed');

      tasks.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return tasks;
    },
    enabled: !!user?.uid,
  });
}

// Create a task
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      title: string;
      description?: string;
      assignedTo?: string;
      priority: Task['priority'];
      dueDate?: string;
      photoId?: string;
    }) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const taskData = {
        ...data,
        companyId: profile.companyId,
        createdBy: user.uid,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'tasks'), taskData);

      // Log activity
      await logActivity({
        companyId: profile.companyId,
        projectId: data.projectId,
        userId: user.uid,
        activityType: 'task_created',
        message: `${profile.fullName} created task "${data.title}"`,
        entityType: 'task',
        entityId: docRef.id,
      });

      // Notify assigned user if different from creator
      if (data.assignedTo && data.assignedTo !== user.uid) {
        await createNotification({
          userId: data.assignedTo,
          companyId: profile.companyId,
          type: 'task_assigned',
          title: `${profile.fullName} assigned you a task`,
          body: `Task: "${data.title}"`,
          entityType: 'task',
          entityId: docRef.id,
          actionUrl: `/projects/${data.projectId}`,
        });
      }

      return { id: docRef.id, ...taskData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// Update a task
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'tasks', id), updateData);

      return { id, ...updateData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// Mark a task as completed
export function useCompleteTask() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        completedBy: user.uid,
        updatedAt: serverTimestamp(),
      });

      // Log activity
      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'task_completed',
        message: `${profile.fullName} completed a task`,
        entityType: 'task',
        entityId: taskId,
      });

      return taskId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// Delete a task
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      await deleteDoc(doc(db, 'tasks', taskId));
      return taskId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// Fetch count of incomplete tasks assigned to current user
export function useTaskCounts() {
  const { user } = useAuthContext();
  const userId = user?.uid;

  return useQuery({
    queryKey: ['taskCounts', userId],
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;

      const q = query(
        collection(db, 'tasks'),
        where('assignedTo', '==', userId),
        where('status', '!=', 'completed')
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    },
    enabled: !!user?.uid,
  });
}
