import { useState, useMemo, useEffect } from 'react';
import {
  DollarSign,
  Plus,
  X,
  Trash2,
  Send,
  Copy,
  ExternalLink,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import {
  usePaymentsByCompany,
  useCreatePaymentRequest,
  useSendPaymentRequest,
  usePaymentStats,
} from '@/hooks/usePaymentRequests';
import { useProjects } from '@/hooks/useProjects';
import { useIntegration } from '@/hooks/useIntegrations';
import { getQBOInvoices, type QBOConfig } from '@/lib/integrations/quickbooksSync';
import { cn } from '@/lib/utils';
import type { PaymentStatus, PaymentLineItem } from '@/types';

// ============================================================================
// Helpers
// ============================================================================

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadge(status: PaymentStatus) {
  const map: Record<PaymentStatus, { label: string; className: string }> = {
    pending: {
      label: 'Pending',
      className: 'bg-amber-100 text-amber-700',
    },
    sent: {
      label: 'Sent',
      className: 'bg-blue-100 text-blue-700',
    },
    paid: {
      label: 'Paid',
      className: 'bg-emerald-100 text-emerald-700',
    },
    declined: {
      label: 'Declined',
      className: 'bg-red-100 text-red-700',
    },
    refunded: {
      label: 'Refunded',
      className: 'bg-slate-100 text-slate-600',
    },
  };
  return map[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' };
}

// ============================================================================
// Line Item Row (for the create form)
// ============================================================================

interface LineItemRowProps {
  item: { description: string; amount: string; quantity: string };
  index: number;
  onChange: (index: number, field: string, value: string) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

function LineItemRow({ item, index, onChange, onRemove, canRemove }: LineItemRowProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <Input
          placeholder="Description"
          value={item.description}
          onChange={(e) => onChange(index, 'description', e.target.value)}
        />
      </div>
      <div className="w-28">
        <Input
          placeholder="Amount"
          type="number"
          step="0.01"
          min="0"
          value={item.amount}
          onChange={(e) => onChange(index, 'amount', e.target.value)}
        />
      </div>
      <div className="w-20">
        <Input
          placeholder="Qty"
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) => onChange(index, 'quantity', e.target.value)}
        />
      </div>
      <div className="w-24 pt-3 text-right text-sm font-medium text-slate-700">
        {formatCents(
          Math.round(parseFloat(item.amount || '0') * 100) * parseInt(item.quantity || '1', 10)
        )}
      </div>
      {canRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="mt-3 text-slate-400 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Create Payment Modal
// ============================================================================

interface CreatePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DraftLineItem {
  description: string;
  amount: string;
  quantity: string;
}

function CreatePaymentModal({ isOpen, onClose }: CreatePaymentModalProps) {
  const { data: projects } = useProjects();
  const createPayment = useCreatePaymentRequest();

  const [projectId, setProjectId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [description, setDescription] = useState('');
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([
    { description: '', amount: '', quantity: '1' },
  ]);

  const totalCents = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const amount = Math.round(parseFloat(item.amount || '0') * 100);
      const qty = parseInt(item.quantity || '1', 10);
      return sum + amount * qty;
    }, 0);
  }, [lineItems]);

  const handleLineItemChange = (index: number, field: string, value: string) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, { description: '', amount: '', quantity: '1' }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setProjectId('');
    setCustomerName('');
    setCustomerEmail('');
    setDescription('');
    setLineItems([{ description: '', amount: '', quantity: '1' }]);
  };

  const handleSubmit = async (sendImmediately: boolean) => {
    if (!projectId) return;

    const validLineItems: PaymentLineItem[] = lineItems
      .filter((item) => item.description && item.amount)
      .map((item) => ({
        description: item.description,
        amount: Math.round(parseFloat(item.amount) * 100),
        quantity: parseInt(item.quantity || '1', 10),
      }));

    if (validLineItems.length === 0) return;

    try {
      await createPayment.mutateAsync({
        projectId,
        amountCents: totalCents,
        description: description || undefined,
        lineItems: validLineItems,
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
      });

      // If sendImmediately is true, the user would still need to use the
      // "Send" action on the table row — the create just saves the draft.
      // For V1, all new requests start as 'pending'.

      if (!sendImmediately) {
        resetForm();
        onClose();
      } else {
        resetForm();
        onClose();
      }
    } catch {
      // Error handled by mutation state
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-2xl rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Create Payment Request
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          {/* Project selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Project
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <option value="">Select a project...</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Customer info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Customer Name
              </label>
              <Input
                placeholder="John Smith"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Customer Email
              </label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Description (optional)
            </label>
            <Input
              placeholder="Project milestone payment, materials cost, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Line Items */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Line Items
            </label>
            <div className="space-y-2">
              {/* Header row */}
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
                <div className="flex-1">Description</div>
                <div className="w-28">Amount ($)</div>
                <div className="w-20">Qty</div>
                <div className="w-24 text-right">Total</div>
                {lineItems.length > 1 && <div className="w-4" />}
              </div>
              {lineItems.map((item, index) => (
                <LineItemRow
                  key={index}
                  item={item}
                  index={index}
                  onChange={handleLineItemChange}
                  onRemove={removeLineItem}
                  canRemove={lineItems.length > 1}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addLineItem}
              className="mt-2 flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Add line item
            </button>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">Total</span>
            <span className="text-xl font-bold text-slate-900">
              {formatCents(totalCents)}
            </span>
          </div>

          {/* Error */}
          {createPayment.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">
                {createPayment.error instanceof Error
                  ? createPayment.error.message
                  : 'Failed to create payment request.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit(false)}
            isLoading={createPayment.isPending}
            disabled={!projectId || totalCents === 0 || createPayment.isPending}
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            isLoading={createPayment.isPending}
            disabled={!projectId || totalCents === 0 || createPayment.isPending}
          >
            <Send className="h-4 w-4" />
            Create & Send
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Payments Page
// ============================================================================

// QuickBooks invoice type (from QBO API response)
interface QBOInvoice {
  Id: string;
  DocNumber?: string;
  CustomerRef?: { value: string; name: string };
  TotalAmt: number;
  Balance: number;
  DueDate?: string;
  TxnDate?: string;
  EmailStatus?: string;
}

export default function PaymentsPage() {
  const { data: payments, isLoading } = usePaymentsByCompany();
  const { totalOutstandingCents, totalPaidCents, pendingCount } = usePaymentStats();
  const sendPayment = useSendPaymentRequest();

  const [activeTab, setActiveTab] = useState<'requests' | 'quickbooks'>('requests');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // QuickBooks state
  const qbIntegration = useIntegration('quickbooks');
  const isQBConnected = !!qbIntegration?.isActive;
  const [qbInvoices, setQbInvoices] = useState<QBOInvoice[]>([]);
  const [qbLoading, setQbLoading] = useState(false);
  const [qbError, setQbError] = useState<string | null>(null);

  // Load QuickBooks invoices when connected and tab is active
  const loadQBInvoices = async () => {
    if (!qbIntegration?.config) return;
    setQbLoading(true);
    setQbError(null);
    try {
      const config: QBOConfig = {
        ...(qbIntegration.config as unknown as QBOConfig),
        // Pass the OAuth access token from the integration record
        accessToken: qbIntegration.accessToken || (qbIntegration.config as Record<string, unknown>).accessToken as string | undefined,
      };
      const result = await getQBOInvoices(config);
      setQbInvoices((result.invoices as QBOInvoice[]) ?? []);
    } catch (err) {
      setQbError(err instanceof Error ? err.message : 'Failed to load invoices');
    }
    setQbLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'quickbooks' && isQBConnected && qbInvoices.length === 0 && !qbLoading) {
      void loadQBInvoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isQBConnected]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    if (!payments) return [];

    return payments.filter((p) => {
      // Status filter
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesCustomer = p.customerName?.toLowerCase().includes(q);
        const matchesEmail = p.customerEmail?.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        const matchesId = p.id.toLowerCase().includes(q);
        if (!matchesCustomer && !matchesEmail && !matchesDesc && !matchesId) {
          return false;
        }
      }

      return true;
    });
  }, [payments, statusFilter, searchQuery]);

  const handleSend = async (paymentId: string, projectId: string) => {
    try {
      await sendPayment.mutateAsync({ paymentRequestId: paymentId, projectId });
    } catch {
      // Error handled by mutation state
    }
  };

  const handleCopyLink = async (shareToken: string, paymentId: string) => {
    const url = `${window.location.origin}/pay/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(paymentId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback: silently fail
    }
  };

  const handleViewPublic = (shareToken: string) => {
    window.open(`/pay/${shareToken}`, '_blank');
  };

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage billing, invoices, and payment tracking for your projects.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          New Payment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Outstanding
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {formatCents(totalOutstandingCents)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Total Paid
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {formatCents(totalPaidCents)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Pending
                </p>
                <p className="text-xl font-bold text-slate-900">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs — Payment Requests vs QuickBooks */}
      {isQBConnected && (
        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab('requests')}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'requests'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <DollarSign className="mr-1.5 inline h-4 w-4" />
            Payment Requests
          </button>
          <button
            onClick={() => setActiveTab('quickbooks')}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              activeTab === 'quickbooks'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <FileText className="mr-1.5 inline h-4 w-4" />
            QuickBooks Invoices
          </button>
        </div>
      )}

      {/* QuickBooks Invoices Tab */}
      {activeTab === 'quickbooks' && isQBConnected && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">QuickBooks Online Invoices</h2>
            <Button variant="outline" size="sm" onClick={() => void loadQBInvoices()} disabled={qbLoading}>
              {qbLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>

          {qbError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{qbError}</p>
            </div>
          )}

          {qbLoading && qbInvoices.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : qbInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-16">
              <FileText className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">No invoices found in QuickBooks</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                      <th className="px-4 py-3">Invoice #</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {qbInvoices.map((inv) => {
                      const isPaid = inv.Balance === 0;
                      const isOverdue = inv.DueDate && new Date(inv.DueDate) < new Date() && !isPaid;
                      return (
                        <tr key={inv.Id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-700">
                            #{inv.DocNumber || inv.Id}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {inv.CustomerRef?.name || '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900">
                            ${inv.TotalAmt?.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-slate-700">
                            ${inv.Balance?.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                              isPaid ? 'bg-emerald-100 text-emerald-700'
                                : isOverdue ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            )}>
                              {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Open'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-500">
                            {inv.DueDate ? new Date(inv.DueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Requests Tab */}
      {activeTab === 'requests' && (<>
      {/* Filters Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer, email, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'pending', 'sent', 'paid', 'declined'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                statusFilter === s
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Table */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-slate-200 bg-white py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <DollarSign className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-slate-900">
            {payments && payments.length > 0 ? 'No matching payments' : 'No payments yet'}
          </h3>
          <p className="max-w-[280px] text-center text-sm leading-relaxed text-slate-500">
            {payments && payments.length > 0
              ? 'Try adjusting your search or filters.'
              : 'Create your first payment request to get started.'}
          </p>
          {(!payments || payments.length === 0) && (
            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" />
              Create Payment
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((payment) => {
                  const badge = statusBadge(payment.status);
                  const createdDate = payment.createdAt?.toDate
                    ? payment.createdAt.toDate().toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—';

                  return (
                    <tr key={payment.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-slate-700">
                          #{payment.id.slice(-6).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700">
                            {payment.customerName || '—'}
                          </p>
                          {payment.customerEmail && (
                            <p className="text-xs text-slate-400">
                              {payment.customerEmail}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-slate-900">
                          {formatCents(payment.amountCents)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-500">{createdDate}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {/* Send action — only for pending/sent */}
                          {(payment.status === 'pending' || payment.status === 'sent') && (
                            <button
                              onClick={() => handleSend(payment.id, payment.projectId)}
                              disabled={sendPayment.isPending}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                              title="Send payment request"
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          )}

                          {/* Copy link */}
                          <button
                            onClick={() => handleCopyLink(payment.shareToken, payment.id)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            title="Copy payment link"
                          >
                            {copiedId === payment.id ? (
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>

                          {/* View public page */}
                          <button
                            onClick={() => handleViewPublic(payment.shareToken)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            title="View payment page"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      </>)}

      {/* Send error toast */}
      {sendPayment.isError && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-lg">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <p className="text-sm text-red-700">
            Failed to send payment request. Please try again.
          </p>
        </div>
      )}

      {/* Create Modal */}
      <CreatePaymentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}
