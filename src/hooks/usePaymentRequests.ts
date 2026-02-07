import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import type { PaymentRequest, PaymentLineItem } from '@/types';

/**
 * Fetch all payment requests for a given project, ordered by creation date descending.
 */
export function useProjectPayments(projectId: string | undefined) {
  return useQuery({
    queryKey: ['payment_requests', projectId],
    queryFn: async (): Promise<PaymentRequest[]> => {
      if (!projectId) return [];

      const q = query(
        collection(db, 'payment_requests'),
        where('projectId', '==', projectId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PaymentRequest
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
 * Create a new payment request associated with a project.
 * Generates a unique shareToken for the public payment link.
 */
export function useCreatePaymentRequest() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: {
      projectId: string;
      amountCents: number;
      description?: string;
      lineItems: PaymentLineItem[];
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
    }): Promise<{ id: string; shareToken: string }> => {
      if (!profile?.companyId || !user?.uid) {
        throw new Error('Not authenticated');
      }

      const shareToken = crypto.randomUUID();

      const paymentData = {
        projectId: data.projectId,
        companyId: profile.companyId,
        amountCents: data.amountCents,
        currency: 'usd',
        description: data.description || null,
        lineItems: data.lineItems,
        customerName: data.customerName || null,
        customerEmail: data.customerEmail || null,
        customerPhone: data.customerPhone || null,
        status: 'pending' as const,
        stripePaymentIntentId: null,
        stripeCheckoutUrl: null,
        shareToken,
        paidAt: null,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'payment_requests'), paymentData);

      return { id: docRef.id, shareToken };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment_requests', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['payment_requests_company'] });
    },
  });
}

/**
 * Fetch all payment requests for the current user's company (admin dashboard view).
 * Returns payments across all projects, ordered by creation date descending.
 */
export function usePaymentsByCompany() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ['payment_requests_company', companyId],
    queryFn: async (): Promise<PaymentRequest[]> => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'payment_requests'),
        where('companyId', '==', companyId)
      );

      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(
        (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PaymentRequest
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

/**
 * Send a payment request: creates a Stripe Checkout Session via the Cloud Function,
 * then updates the payment request document with the checkout URL and sets status to 'sent'.
 */
export function useSendPaymentRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      paymentRequestId: string;
      projectId: string;
    }): Promise<{ checkoutUrl: string }> => {
      const createCheckoutSession = httpsCallable<
        { paymentRequestId: string; successUrl: string; cancelUrl: string },
        { checkoutUrl: string }
      >(functions, 'createCheckoutSession');

      // Build the public payment URL using the shareToken
      const paymentRef = doc(db, 'payment_requests', data.paymentRequestId);

      const baseUrl = window.location.origin;
      const successUrl = `${baseUrl}/pay/success`;
      const cancelUrl = `${baseUrl}/pay/cancel`;

      const result = await createCheckoutSession({
        paymentRequestId: data.paymentRequestId,
        successUrl,
        cancelUrl,
      });

      // The Cloud Function already updates the doc, but also ensure status is 'sent'
      await updateDoc(paymentRef, {
        status: 'sent',
        updatedAt: serverTimestamp(),
      });

      return { checkoutUrl: result.data.checkoutUrl };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payment_requests', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['payment_requests_company'] });
    },
  });
}

/**
 * Computed payment statistics derived from the company payments query.
 * Returns total outstanding (cents), total paid (cents), and pending count.
 */
export function usePaymentStats() {
  const { data: payments, isLoading } = usePaymentsByCompany();

  const stats = useMemo(() => {
    if (!payments) {
      return {
        totalOutstandingCents: 0,
        totalPaidCents: 0,
        pendingCount: 0,
      };
    }

    let totalOutstandingCents = 0;
    let totalPaidCents = 0;
    let pendingCount = 0;

    for (const p of payments) {
      if (p.status === 'paid') {
        totalPaidCents += p.amountCents;
      } else if (p.status === 'pending' || p.status === 'sent') {
        totalOutstandingCents += p.amountCents;
        pendingCount++;
      }
    }

    return { totalOutstandingCents, totalPaidCents, pendingCount };
  }, [payments]);

  return { ...stats, isLoading };
}
