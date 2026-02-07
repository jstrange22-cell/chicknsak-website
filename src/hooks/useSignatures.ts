import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import type { Signature } from '@/types';

/**
 * Fetch all signatures for a given project, ordered by creation date descending.
 */
export function useProjectSignatures(projectId: string | undefined) {
  return useQuery({
    queryKey: ['signatures', projectId],
    queryFn: async (): Promise<Signature[]> => {
      if (!projectId) return [];

      const q = query(
        collection(db, 'signatures'),
        where('projectId', '==', projectId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as Signature
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

/**
 * Create a new signature request associated with a project.
 * Generates a unique shareToken for the public signing link.
 */
export function useCreateSignatureRequest() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      signerName: string;
      signerEmail?: string;
      documentId?: string;
    }): Promise<{ id: string; shareToken: string }> => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const shareToken = crypto.randomUUID();

      const signatureData = {
        projectId: data.projectId,
        companyId: profile.companyId,
        documentId: data.documentId || null,
        signerName: data.signerName,
        signerEmail: data.signerEmail || null,
        signatureData: null,
        signedAt: null,
        ipAddress: null,
        status: 'pending' as const,
        shareToken,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'signatures'), signatureData);

      return { id: docRef.id, shareToken };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['signatures', variables.projectId] });
    },
  });
}

/**
 * Public mutation: sign a document by updating the signature record
 * with the captured signature data, signed timestamp, and status.
 * Does not require authentication.
 */
export function useSignDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      signatureId,
      signatureDataUrl,
    }: {
      signatureId: string;
      signatureDataUrl: string;
    }): Promise<void> => {
      if (!signatureId || !signatureDataUrl) {
        throw new Error('Signature ID and signature data are required');
      }

      await updateDoc(doc(db, 'signatures', signatureId), {
        signatureData: signatureDataUrl,
        signedAt: Timestamp.now(),
        status: 'signed',
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signatures'] });
    },
  });
}
