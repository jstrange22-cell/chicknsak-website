import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { logActivity } from '@/lib/activityLogger';
import type { ProjectDocument } from '@/types';

// Fetch all documents for a project
export function useProjectDocuments(projectId: string | undefined) {
  return useQuery({
    queryKey: ['documents', projectId],
    queryFn: async (): Promise<ProjectDocument[]> => {
      if (!projectId) return [];

      const q = query(
        collection(db, 'documents'),
        where('projectId', '==', projectId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as ProjectDocument)
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

// Upload a file to Storage and create a Firestore document
export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      projectId,
      file,
      description,
    }: {
      projectId: string;
      file: File;
      description?: string;
    }): Promise<{ id: string; url: string }> => {
      const companyId = profile!.companyId;
      const uuid = crypto.randomUUID();
      const storagePath = `documents/${companyId}/${projectId}/${uuid}-${file.name}`;

      // Upload file to Firebase Storage
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          null,
          (error) => reject(error),
          () => resolve()
        );
      });

      // Get download URL
      const url = await getDownloadURL(storageRef);

      // Create Firestore document
      const docRef = await addDoc(collection(db, 'documents'), {
        projectId,
        companyId,
        userId: user!.uid,
        name: file.name,
        storagePath,
        url,
        fileType: file.type,
        fileSizeBytes: file.size,
        description: description || null,
        metadata: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Log activity
      await logActivity({
        companyId: companyId!,
        projectId,
        userId: user!.uid,
        activityType: 'document_uploaded',
        message: `${profile!.fullName} uploaded "${file.name}"`,
        metadata: { documentId: docRef.id },
      });

      return { id: docRef.id, url };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

// Delete a document from Storage and Firestore
export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({
      documentId,
      storagePath,
      projectId,
    }: {
      documentId: string;
      storagePath: string;
      projectId: string;
    }) => {
      // Delete file from storage (ignore if not found)
      await deleteObject(ref(storage, storagePath)).catch(() => {});

      // Delete Firestore document
      const docRef = doc(db, 'documents', documentId);
      await deleteDoc(docRef);

      // Log activity
      await logActivity({
        companyId: profile!.companyId!,
        projectId,
        userId: user!.uid,
        activityType: 'document_deleted',
        message: `${profile!.fullName} deleted a document`,
        metadata: { documentId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}
