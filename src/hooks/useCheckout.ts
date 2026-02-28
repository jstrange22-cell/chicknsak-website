import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useCart } from './useCart';

interface CheckoutSessionResponse {
  checkoutUrl: string;
}

export function useCheckout() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = useCart((s) => s.items);

  const checkout = useCallback(
    async (customerEmail?: string) => {
      if (items.length === 0) {
        setError('Your cart is empty.');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const createCheckout = httpsCallable<
          {
            items: { productId: string; quantity: number }[];
            customerEmail?: string;
            successUrl: string;
            cancelUrl: string;
          },
          CheckoutSessionResponse
        >(functions, 'cnsCreateCheckoutSession');

        const result = await createCheckout({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          customerEmail,
          successUrl: `${window.location.origin}/checkout/success`,
          cancelUrl: `${window.location.origin}/shop`,
        });

        const { checkoutUrl } = result.data;

        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        } else {
          throw new Error('No checkout URL returned.');
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to create checkout session.';
        setError(message);
        setIsLoading(false);
      }
    },
    [items]
  );

  return { checkout, isLoading, error };
}
