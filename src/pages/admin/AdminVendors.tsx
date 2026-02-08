import { useState, useMemo } from 'react';
import {
  HardHat,
  Plus,
  X,
  Loader2,
  Search,
  Phone,
  Mail,
  Building2,
  Trash2,
  Edit3,
  AlertTriangle,
  Wrench,
} from 'lucide-react';
import { useVendors, useCreateVendor, useUpdateVendor, useDeleteVendor } from '@/hooks/useVendors';
import { cn } from '@/lib/utils';
import type { Vendor, VendorStatus } from '@/types';

// ---------------------------------------------------------------------------
// Specialty options
// ---------------------------------------------------------------------------

const SPECIALTY_OPTIONS = [
  'General',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Roofing',
  'Framing',
  'Concrete',
  'Painting',
  'Flooring',
  'Drywall',
  'Landscaping',
  'Excavation',
  'Insulation',
  'Windows & Doors',
  'Siding',
  'Other',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminVendors() {
  const { data: vendors = [], isLoading } = useVendors();
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | VendorStatus>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formSpecialty, setFormSpecialty] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Stats
  const totalVendors = vendors.length;
  const activeVendors = vendors.filter((v) => v.status === 'active').length;
  const inactiveVendors = vendors.filter((v) => v.status === 'inactive').length;

  // Filtered vendors
  const filteredVendors = useMemo(() => {
    let result = vendors;
    if (statusFilter !== 'all') {
      result = result.filter((v) => v.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.company?.toLowerCase().includes(q) ||
          v.email?.toLowerCase().includes(q) ||
          v.specialty?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [vendors, statusFilter, searchQuery]);

  // Form helpers
  const resetForm = () => {
    setFormName('');
    setFormCompany('');
    setFormEmail('');
    setFormPhone('');
    setFormSpecialty('');
    setFormNotes('');
  };

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormName(vendor.name);
    setFormCompany(vendor.company || '');
    setFormEmail(vendor.email || '');
    setFormPhone(vendor.phone || '');
    setFormSpecialty(vendor.specialty || '');
    setFormNotes(vendor.notes || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const data = {
      name: formName.trim(),
      company: formCompany.trim() || undefined,
      email: formEmail.trim() || undefined,
      phone: formPhone.trim() || undefined,
      specialty: formSpecialty || undefined,
      notes: formNotes.trim() || undefined,
    };

    if (editingVendor) {
      await updateVendor.mutateAsync({ id: editingVendor.id, ...data });
      setEditingVendor(null);
    } else {
      await createVendor.mutateAsync(data);
      setShowAddModal(false);
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (!deletingVendor) return;
    await deleteVendor.mutateAsync(deletingVendor.id);
    setDeletingVendor(null);
  };

  const handleToggleStatus = async (vendor: Vendor) => {
    const newStatus: VendorStatus = vendor.status === 'active' ? 'inactive' : 'active';
    await updateVendor.mutateAsync({ id: vendor.id, status: newStatus });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Form modal content (shared between add & edit)
  const formModal = (showAddModal || editingVendor) && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {editingVendor ? 'Edit Vendor' : 'Add Vendor'}
          </h3>
          <button
            onClick={() => {
              setShowAddModal(false);
              setEditingVendor(null);
              resetForm();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Contact name *"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            type="text"
            placeholder="Company name"
            value={formCompany}
            onChange={(e) => setFormCompany(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            type="email"
            placeholder="Email address"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            type="tel"
            placeholder="Phone number"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <select
            value={formSpecialty}
            onChange={(e) => setFormSpecialty(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Select specialty</option>
            {SPECIALTY_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <textarea
            placeholder="Notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
          />
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setEditingVendor(null);
                resetForm();
              }}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formName.trim() || createVendor.isPending || updateVendor.isPending}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createVendor.isPending || updateVendor.isPending ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : editingVendor ? (
                'Save Changes'
              ) : (
                'Add Vendor'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Delete confirmation modal
  const deleteModal = deletingVendor && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Delete Vendor</h3>
            <p className="text-sm text-slate-500">This action cannot be undone.</p>
          </div>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Are you sure you want to delete <strong>{deletingVendor.name}</strong>
          {deletingVendor.company ? ` (${deletingVendor.company})` : ''}?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setDeletingVendor(null)}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteVendor.isPending}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleteVendor.isPending ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{totalVendors}</p>
          <p className="text-xs font-medium text-slate-500">Total</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{activeVendors}</p>
          <p className="text-xs font-medium text-slate-500">Active</p>
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-400">{inactiveVendors}</p>
          <p className="text-xs font-medium text-slate-500">Inactive</p>
        </div>
      </div>

      {/* Search and filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | VendorStatus)}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Vendor
        </button>
      </div>

      {/* Vendor list */}
      {filteredVendors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16">
          <HardHat className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">
            {vendors.length === 0 ? 'No vendors yet' : 'No vendors match your search'}
          </p>
          {vendors.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">Add your first vendor to get started.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredVendors.map((vendor) => (
            <div
              key={vendor.id}
              className={cn(
                'rounded-xl border bg-white p-4 transition-colors',
                vendor.status === 'inactive'
                  ? 'border-slate-200 opacity-60'
                  : 'border-slate-200 hover:border-slate-300'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">
                      {vendor.name}
                    </h3>
                    {vendor.specialty && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        <Wrench className="h-3 w-3" />
                        {vendor.specialty}
                      </span>
                    )}
                    {vendor.status === 'inactive' && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {vendor.company && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Building2 className="h-3 w-3" />
                        {vendor.company}
                      </span>
                    )}
                    {vendor.email && (
                      <a
                        href={`mailto:${vendor.email}`}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Mail className="h-3 w-3" />
                        {vendor.email}
                      </a>
                    )}
                    {vendor.phone && (
                      <a
                        href={`tel:${vendor.phone}`}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <Phone className="h-3 w-3" />
                        {vendor.phone}
                      </a>
                    )}
                  </div>
                  {vendor.notes && (
                    <p className="mt-1.5 text-xs text-slate-400 line-clamp-1">{vendor.notes}</p>
                  )}
                </div>
                <div className="ml-3 flex items-center gap-1">
                  <button
                    onClick={() => handleToggleStatus(vendor)}
                    className={cn(
                      'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                      vendor.status === 'active'
                        ? 'text-slate-500 hover:bg-slate-100'
                        : 'text-green-600 hover:bg-green-50'
                    )}
                  >
                    {vendor.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => openEditModal(vendor)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeletingVendor(vendor)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {formModal}
      {deleteModal}
    </div>
  );
}
