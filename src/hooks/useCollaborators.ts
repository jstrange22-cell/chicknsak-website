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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { logActivity } from '@/lib/activityLogger';
import type { Collaborator, CollaboratorRole, CollaboratorPermissions } from '@/types';

// Fetch collaborators for a project
export function useProjectCollaborators(projectId: string | undefined) {
  return useQuery({
    queryKey: ['collaborators', projectId],
    queryFn: async (): Promise<Collaborator[]> => {
      if (!projectId) return [];

      const q = query(
        collection(db, 'collaborators'),
        where('projectId', '==', projectId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Collaborator)
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

// Invite a collaborator
export function useInviteCollaborator() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      projectId,
      email,
      name,
      phone,
      role,
      permissions,
      expiresInDays,
    }: {
      projectId: string;
      email: string;
      name?: string;
      phone?: string;
      role: CollaboratorRole;
      permissions: CollaboratorPermissions;
      expiresInDays?: number;
    }) => {
      const companyId = profile!.companyId;

      const docData: Record<string, unknown> = {
        projectId,
        companyId,
        email,
        name: name || null,
        phone: phone || null,
        role,
        permissions,
        accessToken: crypto.randomUUID(),
        invitedBy: user!.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (expiresInDays) {
        docData.expiresAt = Timestamp.fromDate(
          new Date(Date.now() + expiresInDays * 86400000)
        );
      }

      const docRef = await addDoc(collection(db, 'collaborators'), docData);

      // Log activity
      await logActivity({
        companyId: companyId!,
        projectId,
        userId: user!.uid,
        activityType: 'collaborator_invited',
        message: `${profile!.fullName} invited ${email} as ${role}`,
        metadata: { collaboratorId: docRef.id, email, role },
      });

      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}

// Remove a collaborator
export function useRemoveCollaborator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const docRef = doc(db, 'collaborators', id);
      await deleteDoc(docRef);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}

// Update collaborator permissions
export function useUpdatePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      permissions,
      role,
    }: {
      id: string;
      permissions: CollaboratorPermissions;
      role?: CollaboratorRole;
    }) => {
      const docRef = doc(db, 'collaborators', id);
      const updateData: Record<string, unknown> = {
        permissions,
        updatedAt: serverTimestamp(),
      };

      if (role) {
        updateData.role = role;
      }

      await updateDoc(docRef, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}
