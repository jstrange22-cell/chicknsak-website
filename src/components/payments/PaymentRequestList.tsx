import { useState } from 'react';
import {
  DollarSign,
  Copy,
  CheckCircle,
  Clock,
  Send,
  XCircle,
  RotateCcw,
  Inbox,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { PaymentRequest, PaymentStatus } from '@/types';

interface PaymentRequestListProps {
  payments: PaymentRequest[];
  isLoading?: boolean;
}

const statusConfig: Record<
  PaymentStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Pending',
    color: 'bg-amber-100 text-amber-700',
    icon: <Clock className="h-3 w-3" />,
  },
  sent: {
    label: 'Sent',
    color: 'bg-blue-100 text-blue-700',
    icon: <Send className="h-3 w-3" />,
  },
  paid: {
    label: 'Paid',
    color: 'bg-emerald-100 text-emerald-700',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  declined: {
    label: 'Declined',
    color: 'bg-red-100 text-red-700',
    icon: <XCircle className="h-3 w-3" />,
  },
  refunded: {
    label: 'Refunded',
    color: 'bg-slate-100 text-slate-700',
    icon: <RotateCcw className="h-3 w-3" />,
  },
};

/**
 * Format cents to a $XX.XX display string.
 */
function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format a Firestore Timestamp to a human-readable date string.
 */
function formatDate(timestamp: { toDate: () => Date } | undefined): string {
  if (!timestamp) return '';
  try {
    return timestamp.toDate().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function PaymentCard({ payment }: { payment: PaymentRequest }) {
  const [copied, setCopied] = useState(false);
  const status = statusConfig[payment.status];
  const showShareLink = payment.status === 'pending' || payment.status === 'sent';
  const shareLink = `${window.location.origin}/pay/${payment.shareToken}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: amount and details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900">
                {formatAmount(payment.amountCents)}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  status.color
                )}
              >
                {status.icon}
                {status.label}
              </span>
            </div>

            {payment.customerName && (
              <p className="mt-1 text-sm font-medium text-slate-700">
                {payment.customerName}
              </p>
            )}

            {payment.description && (
              <p className="mt-0.5 truncate text-sm text-slate-500">
                {payment.description}
              </p>
            )}

            <p className="mt-1 text-xs text-slate-400">
              {formatDate(payment.createdAt)}
              {payment.status === 'paid' && payment.paidAt && (
                <> &middot; Paid {formatDate(payment.paidAt)}</>
              )}
            </p>
          </div>

          {/* Right: dollar icon */}
          <div
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
              payment.status === 'paid'
                ? 'bg-emerald-100'
                : 'bg-slate-100'
            )}
          >
            <DollarSign
              className={cn(
                'h-5 w-5',
                payment.status === 'paid'
                  ? 'text-emerald-600'
                  : 'text-slate-400'
              )}
            />
          </div>
        </div>

        {/* Share link for pending/sent payments */}
        {showShareLink && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="flex-1 truncate text-xs text-slate-500">
              {shareLink}
            </span>
            <Button
              type="button"
              variant={copied ? 'secondary' : 'ghost'}
              size="sm"
              onClick={handleCopyLink}
              className="h-7 px-2"
            >
              {copied ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PaymentRequestList({
  payments,
  isLoading,
}: PaymentRequestListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="animate-pulse space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-20 rounded bg-slate-200" />
                  <div className="h-5 w-16 rounded-full bg-slate-200" />
                </div>
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="h-3 w-24 rounded bg-slate-200" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-12">
        <Inbox className="mb-3 h-10 w-10 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">
          No payment requests yet
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Create a payment request to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((payment) => (
        <PaymentCard key={payment.id} payment={payment} />
      ))}
    </div>
  );
}
