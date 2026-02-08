import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import type { User } from '@/types';

/**
 * Fetch all registered users belonging to the current user's company.
 * Returns active and inactive users; filter client-side as needed.
 */
export function useCompanyUsers() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ['companyUsers', companyId],
    queryFn: async (): Promise<User[]> => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'users'),
        where('companyId', '==', companyId),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as User));
    },
    enabled: !!companyId,
  });
}
