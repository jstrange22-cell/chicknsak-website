import { useState } from 'react';
import {
  X,
  Copy,
  CheckCircle,
  DollarSign,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { useCreatePaymentRequest } from '@/hooks/usePaymentRequests';
import type { PaymentLineItem } from '@/types';

interface CreatePaymentRequestProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface LineItemRow {
  id: string;
  description: string;
  amount: string;
  quantity: string;
}

function createEmptyLineItem(): LineItemRow {
  return {
    id: crypto.randomUUID(),
    description: '',
    amount: '',
    quantity: '1',
  };
}

export function CreatePaymentRequest({
  projectId,
  isOpen,
  onClose,
}: CreatePaymentRequestProps) {
  const createPayment = useCreatePaymentRequest();

  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lineItems, setLineItems] = useState<LineItemRow[]>([createEmptyLineItem()]);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const shareLink = shareToken
    ? `${window.location.origin}/pay/${shareToken}`
    : null;

  /**
   * Calculate total from line items in cents.
   */
  const calculateTotalCents = (): number => {
    return lineItems.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      const quantity = parseInt(item.quantity, 10) || 0;
      return sum + Math.round(amount * 100) * quantity;
    }, 0);
  };

  /**
   * Format cents to dollars display string.
   */
  const formatCents = (cents: number): string => {
    return (cents / 100).toFixed(2);
  };

  const totalCents = calculateTotalCents();

  const handleAddLineItem = () => {
    setLineItems((prev) => [...prev, createEmptyLineItem()]);
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleLineItemChange = (
    id: string,
    field: keyof Omit<LineItemRow, 'id'>,
    value: string
  ) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate that we have at least one valid line item
    const validLineItems: PaymentLineItem[] = lineItems
      .filter((item) => item.description.trim() && parseFloat(item.amount) > 0)
      .map((item) => ({
        description: item.description.trim(),
        amount: Math.round(parseFloat(item.amount) * 100),
        quantity: parseInt(item.quantity, 10) || 1,
      }));

    if (validLineItems.length === 0) {
      setError('Please add at least one line item with a description and amount.');
      return;
    }

    const amountCents = validLineItems.reduce(
      (sum, item) => sum + item.amount * item.quantity,
      0
    );

    if (amountCents <= 0) {
      setError('Total amount must be greater than zero.');
      return;
    }

    try {
      const result = await createPayment.mutateAsync({
        projectId,
        amountCents,
        description: description.trim() || undefined,
        lineItems: validLineItems,
        customerName: customerName.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      });
      setShareToken(result.shareToken);
    } catch (err) {
      console.error('Failed to create payment request:', err);
      setError('Failed to create payment request. Please try again.');
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;

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

  const handleClose = () => {
    setDescription('');
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setLineItems([createEmptyLineItem()]);
    setShareToken(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50">
      <div className="w-full min-h-screen bg-white md:min-h-0 md:my-8 md:max-w-xl md:rounded-xl md:shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:rounded-t-xl">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold">
              {shareToken ? 'Payment Link Ready' : 'Create Payment Request'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {shareToken && shareLink ? (
            /* Success state */
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-center text-sm text-slate-600">
                  Payment request for{' '}
                  <span className="font-semibold text-slate-900">
                    ${formatCents(totalCents)}
                  </span>{' '}
                  created successfully. Share the link below with your customer.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-1 truncate bg-transparent text-sm text-slate-700 outline-none"
                />
                <Button
                  type="button"
                  variant={copied ? 'secondary' : 'default'}
                  size="sm"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          ) : (
            /* Form state */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Description
                </label>
                <Textarea
                  placeholder="What is this payment for? (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  Line Items <span className="text-red-500">*</span>
                </label>

                <div className="space-y-2">
                  {lineItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) =>
                            handleLineItemChange(item.id, 'description', e.target.value)
                          }
                        />
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                              $
                            </span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={item.amount}
                              onChange={(e) =>
                                handleLineItemChange(item.id, 'amount', e.target.value)
                              }
                              className="pl-7"
                            />
                          </div>
                          <div className="w-20">
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) =>
                                handleLineItemChange(item.id, 'quantity', e.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(item.id)}
                          className="mt-1 rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-red-500"
                          aria-label={`Remove line item ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddLineItem}
                >
                  <Plus className="h-4 w-4" />
                  Add Line Item
                </Button>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between rounded-lg bg-slate-100 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">Total</span>
                <span className="text-lg font-bold text-slate-900">
                  ${formatCents(totalCents)}
                </span>
              </div>

              {/* Customer Info */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="mb-3 text-sm font-medium text-slate-700">
                  Customer Information
                </h3>
                <div className="space-y-3">
                  <Input
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <Input
                    type="email"
                    placeholder="Customer email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                  <Input
                    type="tel"
                    placeholder="Customer phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button
                type="submit"
                className="w-full"
                isLoading={createPayment.isPending}
                disabled={totalCents <= 0}
              >
                Create Payment Request
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
