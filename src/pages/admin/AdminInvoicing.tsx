import { useState, useMemo } from 'react';
import {
  Plus,
  X,
  Loader2,
  FileText,
  Send,
  CheckCircle2,
  Trash2,
  DollarSign,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';
import type { Invoice, InvoiceStatus, InvoiceLineItem } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${y}${m}-${rand}`;
}

const statusConfig: Record<InvoiceStatus, { label: string; classes: string }> = {
  draft: { label: 'Draft', classes: 'bg-slate-100 text-slate-700' },
  sent: { label: 'Sent', classes: 'bg-blue-100 text-blue-700' },
  paid: { label: 'Paid', classes: 'bg-emerald-100 text-emerald-700' },
  overdue: { label: 'Overdue', classes: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', classes: 'bg-slate-100 text-slate-400' },
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useInvoices() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ['admin', 'invoices', companyId],
    queryFn: async (): Promise<Invoice[]> => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'invoices'),
        where('companyId', '==', companyId),
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice));
      data.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
        return bTime - aTime;
      });
      return data;
    },
    enabled: !!companyId,
  });
}

function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: {
      customerName: string;
      customerEmail: string;
      lineItems: InvoiceLineItem[];
      dueDate: string;
      notes: string;
    }) => {
      if (!profile?.companyId || !user?.uid) throw new Error('Not authenticated');

      const subtotalCents = data.lineItems.reduce((sum, li) => sum + li.amount * li.quantity, 0);
      const taxCents = 0;
      const totalCents = subtotalCents + taxCents;

      const invoiceData = {
        companyId: profile.companyId,
        customerName: data.customerName,
        customerEmail: data.customerEmail || null,
        lineItems: data.lineItems,
        subtotalCents,
        taxCents,
        totalCents,
        status: 'draft' as const,
        dueDate: data.dueDate || null,
        notes: data.notes || null,
        invoiceNumber: generateInvoiceNumber(),
        createdBy: user.uid,
        paidAt: null,
        sentAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'invoices'), invoiceData);

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'document_uploaded',
        message: `${profile.fullName} created invoice ${invoiceData.invoiceNumber}`,
        entityType: 'invoice',
        entityId: docRef.id,
      });

      return { id: docRef.id, ...invoiceData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'invoices'] });
    },
  });
}

function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ invoiceId, status }: { invoiceId: string; status: InvoiceStatus }) => {
      if (!profile?.companyId || !user?.uid) throw new Error('Not authenticated');

      const updateData: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };

      if (status === 'sent') {
        updateData.sentAt = serverTimestamp();
      }
      if (status === 'paid') {
        updateData.paidAt = serverTimestamp();
      }

      await updateDoc(doc(db, 'invoices', invoiceId), updateData);

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'document_uploaded',
        message: `${profile.fullName} updated invoice status to ${status}`,
        entityType: 'invoice',
        entityId: invoiceId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'invoices'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Create Invoice Modal
// ---------------------------------------------------------------------------

interface CreateInvoiceModalProps {
  onClose: () => void;
}

function CreateInvoiceModal({ onClose }: CreateInvoiceModalProps) {
  const createInvoice = useCreateInvoice();
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { description: '', amount: 0, quantity: 1 },
  ]);

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', amount: 0, quantity: 1 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    const updated = [...lineItems];
    if (field === 'description') {
      updated[index] = { ...updated[index], description: value as string };
    } else if (field === 'amount') {
      updated[index] = { ...updated[index], amount: Math.round(Number(value) * 100) };
    } else if (field === 'quantity') {
      updated[index] = { ...updated[index], quantity: Number(value) || 1 };
    }
    setLineItems(updated);
  };

  const total = lineItems.reduce((sum, li) => sum + li.amount * li.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return;

    const validItems = lineItems.filter((li) => li.description.trim() && li.amount > 0);
    if (validItems.length === 0) return;

    try {
      await createInvoice.mutateAsync({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        lineItems: validItems,
        dueDate,
        notes,
      });
      onClose();
    } catch (err) {
      console.error('Failed to create invoice:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-semibold text-slate-900">Create Invoice</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
                className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Line Items */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Line Items</label>
            <div className="space-y-2">
              {lineItems.map((li, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={li.description}
                    onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                    placeholder="Description"
                    className="flex-1 h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={li.amount > 0 ? (li.amount / 100).toFixed(2) : ''}
                    onChange={(e) => updateLineItem(i, 'amount', e.target.value)}
                    placeholder="$0.00"
                    step="0.01"
                    min="0"
                    className="w-24 h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={li.quantity}
                    onChange={(e) => updateLineItem(i, 'quantity', e.target.value)}
                    min="1"
                    className="w-16 h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeLineItem(i)}
                    className="p-1 rounded hover:bg-slate-100"
                    disabled={lineItems.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLineItem}
              className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Line Item
            </button>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-700">Total</span>
            <span className="text-lg font-bold text-slate-900">{formatCents(total)}</span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createInvoice.isPending}
              className="flex-1 h-10 rounded-lg bg-blue-500 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {createInvoice.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Invoice
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminInvoicing Component
// ---------------------------------------------------------------------------

export default function AdminInvoicing() {
  const { data: invoices = [], isLoading } = useInvoices();
  const updateStatus = useUpdateInvoiceStatus();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredInvoices = useMemo(() => {
    if (filterStatus === 'all') return invoices;
    return invoices.filter((inv) => inv.status === filterStatus);
  }, [invoices, filterStatus]);

  // Stats
  const stats = useMemo(() => {
    const outstanding = invoices
      .filter((inv) => inv.status === 'sent' || inv.status === 'overdue')
      .reduce((sum, inv) => sum + inv.totalCents, 0);
    const paid = invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.totalCents, 0);
    const drafts = invoices.filter((inv) => inv.status === 'draft').length;
    return { outstanding, paid, drafts, total: invoices.length };
  }, [invoices]);

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Outstanding</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{formatCents(stats.outstanding)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Paid</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{formatCents(stats.paid)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Drafts</p>
          <p className="mt-1 text-2xl font-bold text-slate-600">{stats.drafts}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Invoices</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Invoice
        </button>
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="h-10 w-10 mb-2" />
            <p className="text-sm">No invoices found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-sm font-medium text-slate-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{inv.customerName}</p>
                      {inv.customerEmail && (
                        <p className="text-xs text-slate-500">{inv.customerEmail}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {formatCents(inv.totalCents)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          statusConfig[inv.status].classes,
                        )}
                      >
                        {statusConfig[inv.status].label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {inv.dueDate
                        ? new Date(inv.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                        : '--'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {inv.createdAt?.toDate?.()
                        ? inv.createdAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                        : '--'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => updateStatus.mutate({ invoiceId: inv.id, status: 'sent' })}
                            disabled={updateStatus.isPending}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            <Send className="h-3 w-3" />
                            Send
                          </button>
                        )}
                        {(inv.status === 'sent' || inv.status === 'overdue') && (
                          <button
                            onClick={() => updateStatus.mutate({ invoiceId: inv.id, status: 'paid' })}
                            disabled={updateStatus.isPending}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Mark Paid
                          </button>
                        )}
                        {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => updateStatus.mutate({ invoiceId: inv.id, status: 'cancelled' })}
                            disabled={updateStatus.isPending}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                          >
                            <DollarSign className="h-3 w-3" />
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && <CreateInvoiceModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
