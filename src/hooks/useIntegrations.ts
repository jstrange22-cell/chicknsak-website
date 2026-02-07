// Integration management hooks for connecting, disconnecting, and querying
// third-party integrations (JobTread, Zapier, QuickBooks, Google Drive, etc.)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import type { Integration, IntegrationProvider, SyncStatus } from '@/types';

// ---------------------------------------------------------------------------
// Query keys (centralized to avoid typos)
// ---------------------------------------------------------------------------

const INTEGRATIONS_KEY = 'integrations';
const SYNC_QUEUE_KEY = 'syncQueue';

// ---------------------------------------------------------------------------
// Read hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all integrations for the current user's company.
 */
export function useIntegrations() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: [INTEGRATIONS_KEY, companyId],
    queryFn: async (): Promise<Integration[]> => {
      if (!companyId) return [];

      const ref = collection(db, 'integrations');
      const q = query(ref, where('companyId', '==', companyId));
      const snap = await getDocs(q);

      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Integration));
    },
    enabled: !!companyId,
  });
}

/**
 * Convenience hook that returns a single integration by provider, or null.
 */
export function useIntegration(provider: IntegrationProvider): Integration | null {
  const { data: integrations } = useIntegrations();
  return integrations?.find((i) => i.provider === provider) ?? null;
}

// ---------------------------------------------------------------------------
// Mutation: Connect an integration
// ---------------------------------------------------------------------------

interface ConnectIntegrationInput {
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  config?: Record<string, unknown>;
}

/**
 * Stores a new integration document in Firestore.
 * Typically called after a successful OAuth callback.
 */
export function useConnectIntegration() {
  const { profile } = useAuthContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider,
      accessToken,
      refreshToken,
      config,
    }: ConnectIntegrationInput) => {
      if (!profile?.companyId) {
        throw new Error('No company associated with the current user');
      }

      const ref = doc(collection(db, 'integrations'));
      const integrationData: Record<string, unknown> = {
        id: ref.id,
        companyId: profile.companyId,
        provider,
        accessToken,
        refreshToken: refreshToken ?? null,
        config: config ?? {},
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(ref, integrationData);
      return { id: ref.id, provider };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INTEGRATIONS_KEY] });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Disconnect (delete) an integration
// ---------------------------------------------------------------------------

/**
 * Removes an integration document from Firestore.
 */
export function useDisconnectIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (integrationId: string) => {
      if (!integrationId) {
        throw new Error('Integration ID is required');
      }
      await deleteDoc(doc(db, 'integrations', integrationId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INTEGRATIONS_KEY] });
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: Update last synced timestamp
// ---------------------------------------------------------------------------

/**
 * Updates the lastSyncedAt field on an existing integration document.
 */
export function useUpdateSyncTimestamp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (integrationId: string) => {
      if (!integrationId) {
        throw new Error('Integration ID is required');
      }
      await updateDoc(doc(db, 'integrations', integrationId), {
        lastSyncedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [INTEGRATIONS_KEY] });
    },
  });
}

// ---------------------------------------------------------------------------
// Sync queue status
// ---------------------------------------------------------------------------

interface SyncQueueCounts {
  pending: number;
  processing: number;
  failed: number;
  completed: number;
  total: number;
}

/**
 * Fetches aggregate counts of sync queue items for the current company.
 */
export function useSyncQueue() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: [SYNC_QUEUE_KEY, companyId],
    queryFn: async (): Promise<SyncQueueCounts> => {
      if (!companyId) {
        return { pending: 0, processing: 0, failed: 0, completed: 0, total: 0 };
      }

      const ref = collection(db, 'syncQueue');
      const q = query(ref, where('companyId', '==', companyId));
      const snap = await getDocs(q);

      const items = snap.docs.map((d) => d.data());
      const countByStatus = (status: SyncStatus) =>
        items.filter((i) => i.status === status).length;

      return {
        pending: countByStatus('pending'),
        processing: countByStatus('processing'),
        failed: countByStatus('failed'),
        completed: countByStatus('completed'),
        total: items.length,
      };
    },
    enabled: !!companyId,
    // Refresh every 30 seconds so the dashboard widget stays current
    refetchInterval: 30_000,
  });
}
