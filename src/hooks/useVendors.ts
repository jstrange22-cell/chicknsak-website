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
import type { Vendor, VendorStatus } from '@/types';

// Fetch all vendors for the company
export function useVendors() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ['vendors', companyId],
    queryFn: async (): Promise<Vendor[]> => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'vendors'),
        where('companyId', '==', companyId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Vendor)
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

// Create a new vendor
export function useCreateVendor() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      company?: string;
      email?: string;
      phone?: string;
      specialty?: string;
      notes?: string;
    }) => {
      if (!profile?.companyId || !user?.uid) throw new Error('Not authenticated');

      const docData: Record<string, unknown> = {
        companyId: profile.companyId,
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        phone: data.phone || null,
        specialty: data.specialty || null,
        notes: data.notes || null,
        status: 'active' as VendorStatus,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'vendors'), docData);
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}

// Update a vendor
export function useUpdateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      company?: string;
      email?: string;
      phone?: string;
      specialty?: string;
      notes?: string;
      status?: VendorStatus;
    }) => {
      const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.company !== undefined) updateData.company = data.company || null;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.specialty !== undefined) updateData.specialty = data.specialty || null;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.status !== undefined) updateData.status = data.status;

      await updateDoc(doc(db, 'vendors', id), updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}

// Delete a vendor
export function useDeleteVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'vendors', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}
