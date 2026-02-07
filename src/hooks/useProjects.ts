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
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import type { Project, UpdateData } from '@/types';
import { logActivity } from '@/lib/activityLogger';

interface ProjectFilters {
  status?: string;
  labelIds?: string[];
  search?: string;
  sort?: 'newest' | 'oldest' | 'updated' | 'alpha';
  projectType?: string;
}

// Fetch projects list
export function useProjects(filters?: ProjectFilters) {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ['projects', companyId, filters],
    queryFn: async () => {
      if (!companyId) return [];

      // Only use simple equality filters on Firestore to avoid needing
      // composite indexes. Inequality/exclusion filters are applied client-side.
      const constraints: QueryConstraint[] = [
        where('companyId', '==', companyId),
      ];

      // Status equality filter (only when requesting a specific status)
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }

      // Apply project type filter
      if (filters?.projectType) {
        constraints.push(where('projectType', '==', filters.projectType));
      }

      const q = query(collection(db, 'projects'), ...constraints);
      const snapshot = await getDocs(q);

      let projects = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Project[];

      // Default: exclude archived projects client-side (avoids composite index)
      if (!filters?.status) {
        projects = projects.filter((p) => p.status !== 'archived');
      }

      // Apply sorting client-side
      switch (filters?.sort) {
        case 'oldest':
          projects.sort((a, b) => {
            const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
            const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
            return aTime - bTime;
          });
          break;
        case 'updated':
          projects.sort((a, b) => {
            const aTime = (a.updatedAt as any)?.toDate?.()?.getTime() || 0;
            const bTime = (b.updatedAt as any)?.toDate?.()?.getTime() || 0;
            return bTime - aTime;
          });
          break;
        case 'alpha':
          projects.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          break;
        case 'newest':
        default:
          projects.sort((a, b) => {
            const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
            const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
            return bTime - aTime;
          });
      }

      // Client-side search filter (Firestore doesn't support full-text search)
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        projects = projects.filter(
          (p) =>
            p.name.toLowerCase().includes(searchLower) ||
            p.addressFull?.toLowerCase().includes(searchLower) ||
            p.customerName?.toLowerCase().includes(searchLower)
        );
      }

      return projects.slice(0, 50);
    },
    enabled: !!companyId,
  });
}

// Fetch single project
export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      if (!id) return null;
      const docRef = doc(db, 'projects', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as Project;
    },
    enabled: !!id,
  });
}


// Input type for creating a project (fields added by mutation are optional)
type CreateProjectInput = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>> & { name: string };

// Create project mutation
export function useCreateProject() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: CreateProjectInput) => {
      if (!user?.uid) {
        throw new Error('You must be signed in to create a project.');
      }
      if (!profile?.companyId) {
        throw new Error('Your account is missing a company. Please sign out and sign back in to fix this.');
      }

      const projectData = {
        ...data,
        companyId: profile.companyId,
        createdBy: user.uid,
        status: data.status || 'active',
        progress: 0,
        metadata: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'projects'), projectData);

      // Log activity
      await logActivity({
        companyId: profile.companyId,
        projectId: docRef.id,
        userId: user.uid,
        activityType: 'project_created',
        message: `${profile.fullName} created project "${data.name}"`,
        entityType: 'project',
        entityId: docRef.id,
      });

      return { id: docRef.id, ...projectData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// Update project mutation
export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateData<Project> }) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, 'projects', id), updateData);

      // Log activity
      await logActivity({
        companyId: profile.companyId,
        projectId: id,
        userId: user.uid,
        activityType: 'project_updated',
        message: `${profile.fullName} updated project`,
        entityType: 'project',
        entityId: id,
      });

      return { id, ...updateData };
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });
}


// Archive project (soft delete)
export function useArchiveProject() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      await updateDoc(doc(db, 'projects', id), {
        status: 'archived',
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logActivity({
        companyId: profile.companyId,
        projectId: id,
        userId: user.uid,
        activityType: 'project_updated',
        message: `${profile.fullName} archived project`,
        entityType: 'project',
        entityId: id,
      });

      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });
}
