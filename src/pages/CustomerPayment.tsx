import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStripePayment } from '@/hooks/useStripePayment';
import { Button } from '@/components/ui/Button';
import {
  Loader2,
  Building2,
  DollarSign,
  CheckCircle,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import type { PaymentRequest, Company } from '@/types';

type PageState = 'loading' | 'not_found' | 'already_paid' | 'viewing';

/**
 * Format cents to a $XX.XX display string.
 */
function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function CustomerPayment() {
  const { token } = useParams<{ token: string }>();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [payment, setPayment] = useState<PaymentRequest | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { initiateCheckout, isLoading: isCheckoutLoading, error: checkoutError } = useStripePayment();

  useEffect(() => {
    if (!token) {
      setPageState('not_found');
      return;
    }

    async function fetchPayment() {
      try {
        const paymentsRef = collection(db, 'payment_requests');
        const q = query(paymentsRef, where('shareToken', '==', token));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setPageState('not_found');
          return;
        }

        const payDoc = snapshot.docs[0];
        const payData = { id: payDoc.id, ...payDoc.data() } as PaymentRequest;
        setPayment(payData);

        // Fetch company for branding
        if (payData.companyId) {
          try {
            const companyDoc = await getDoc(doc(db, 'companies', payData.companyId));
            if (companyDoc.exists()) {
              setCompany({ id: companyDoc.id, ...companyDoc.data() } as Company);
            }
          } catch {
            // Company fetch is non-critical
          }
        }

        if (payData.status === 'paid') {
          setPageState('already_paid');
        } else if (payData.status === 'declined' || payData.status === 'refunded') {
          setPageState('not_found');
        } else {
          setPageState('viewing');
        }
      } catch (error) {
        console.error('Error fetching payment request:', error);
        setPageState('not_found');
      }
    }

    fetchPayment();
  }, [token]);

  const handlePayNow = async () => {
    if (!payment) return;

    setPaymentError(null);

    try {
      const currentUrl = window.location.href;
      await initiateCheckout({
        paymentRequestId: payment.id,
        successUrl: currentUrl,
        cancelUrl: currentUrl,
      });
    } catch {
      setPaymentError('Something went wrong. Please try again.');
    }
  };

  // --- Loading State ---
  if (pageState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // --- Not Found State ---
  if (pageState === 'not_found') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <AlertCircle className="mb-4 h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-semibold text-slate-700">
          Payment request not found
        </h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          This payment request is no longer available or the link may have expired.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Company Header Bar */}
      {company && (
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
            {company.logoUrl ? (
              <img
                src={company.logoUrl}
                alt={company.name}
                className="h-8 w-8 rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                <Building2 className="h-4 w-4 text-slate-400" />
              </div>
            )}
            <span className="text-sm font-medium text-slate-700">
              {company.name}
            </span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Already Paid State */}
        {pageState === 'already_paid' && payment && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">
              Payment Received
            </h1>
            <p className="text-sm text-slate-500">
              A payment of{' '}
              <span className="font-semibold text-slate-900">
                {formatAmount(payment.amountCents)}
              </span>{' '}
              has been received.
              {payment.paidAt && (
                <>
                  {' '}Paid on{' '}
                  {payment.paidAt.toDate().toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  .
                </>
              )}
            </p>
            {payment.description && (
              <p className="text-sm text-slate-400">{payment.description}</p>
            )}
          </div>
        )}

        {/* Viewing State (payment details + pay button) */}
        {pageState === 'viewing' && payment && (
          <div className="space-y-6">
            {/* Payment Details Card */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              {/* Header */}
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-900">
                      Payment Request
                    </h1>
                    {payment.description && (
                      <p className="text-sm text-slate-500">
                        {payment.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Line Items */}
              {payment.lineItems.length > 0 && (
                <div className="px-6 py-4">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                        <th className="pb-2 pr-4">Item</th>
                        <th className="pb-2 pr-4 text-right">Qty</th>
                        <th className="pb-2 pr-4 text-right">Price</th>
                        <th className="pb-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {payment.lineItems.map((item, index) => {
                        const lineTotal = item.amount * item.quantity;
                        return (
                          <tr key={index} className="text-sm">
                            <td className="py-3 pr-4 text-slate-700">
                              {item.description}
                            </td>
                            <td className="py-3 pr-4 text-right text-slate-500">
                              {item.quantity}
                            </td>
                            <td className="py-3 pr-4 text-right text-slate-500">
                              {formatAmount(item.amount)}
                            </td>
                            <td className="py-3 text-right font-medium text-slate-700">
                              {formatAmount(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Total */}
              <div className="border-t border-slate-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">
                    Total Due
                  </span>
                  <span className="text-2xl font-bold text-slate-900">
                    {formatAmount(payment.amountCents)}
                  </span>
                </div>
                {payment.currency && payment.currency !== 'usd' && (
                  <p className="mt-1 text-right text-xs uppercase text-slate-400">
                    {payment.currency}
                  </p>
                )}
              </div>
            </div>

            {/* Customer Info (if present) */}
            {(payment.customerName || payment.customerEmail) && (
              <div className="rounded-lg border border-slate-200 bg-white px-6 py-4">
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                  Bill To
                </h3>
                {payment.customerName && (
                  <p className="text-sm font-medium text-slate-700">
                    {payment.customerName}
                  </p>
                )}
                {payment.customerEmail && (
                  <p className="text-sm text-slate-500">
                    {payment.customerEmail}
                  </p>
                )}
                {payment.customerPhone && (
                  <p className="text-sm text-slate-500">
                    {payment.customerPhone}
                  </p>
                )}
              </div>
            )}

            {/* Payment Error */}
            {(paymentError || checkoutError) && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <p className="text-sm text-red-700">
                    {paymentError || checkoutError}
                  </p>
                </div>
              </div>
            )}

            {/* Pay Now Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handlePayNow}
              isLoading={isCheckoutLoading}
              disabled={isCheckoutLoading}
            >
              {!isCheckoutLoading && <CreditCard className="h-5 w-5" />}
              {isCheckoutLoading
                ? 'Redirecting to checkout...'
                : `Pay ${formatAmount(payment.amountCents)}`}
            </Button>

            <p className="text-center text-xs text-slate-400">
              Payments are processed securely via Stripe.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <p className="text-center text-xs text-slate-400">
            Powered by JobMate
          </p>
        </div>
      </div>
    </div>
  );
}
