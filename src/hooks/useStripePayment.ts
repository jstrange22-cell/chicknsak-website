import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface CheckoutSessionResponse {
  checkoutUrl: string;
}

/**
 * Hook that initiates a Stripe Checkout session via the createCheckoutSession
 * Cloud Function and redirects the user to the Stripe-hosted payment page.
 */
export function useStripePayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateCheckout = useCallback(
    async (params: {
      paymentRequestId: string;
      successUrl: string;
      cancelUrl: string;
    }) => {
      setIsLoading(true);
      setError(null);

      try {
        const createCheckoutSession = httpsCallable<
          {
            paymentRequestId: string;
            successUrl: string;
            cancelUrl: string;
          },
          CheckoutSessionResponse
        >(functions, 'createCheckoutSession');

        const result = await createCheckoutSession({
          paymentRequestId: params.paymentRequestId,
          successUrl: params.successUrl,
          cancelUrl: params.cancelUrl,
        });

        const { checkoutUrl } = result.data;

        if (checkoutUrl) {
          // Redirect to Stripe Checkout
          window.location.href = checkoutUrl;
        } else {
          throw new Error('No checkout URL returned from server.');
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to create checkout session.';
        setError(message);
        setIsLoading(false);
      }
      // Note: we do NOT setIsLoading(false) on success because
      // the browser is navigating away to Stripe Checkout.
    },
    []
  );

  return { initiateCheckout, isLoading, error };
}
