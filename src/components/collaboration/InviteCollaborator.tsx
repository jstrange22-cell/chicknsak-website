import { useState, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { CollaboratorRole, CollaboratorPermissions } from '@/types';

interface InviteCollaboratorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    email: string;
    name?: string;
    phone?: string;
    role: CollaboratorRole;
    permissions: CollaboratorPermissions;
    expiresInDays?: number;
  }) => void;
  isSubmitting?: boolean;
}

const ROLE_OPTIONS: { value: CollaboratorRole; label: string; description: string }[] = [
  { value: 'viewer', label: 'Viewer', description: 'Can view photos and comments' },
  { value: 'contributor', label: 'Contributor', description: 'Can add photos and comments' },
  { value: 'subcontractor', label: 'Subcontractor', description: 'Full field access' },
];

const EXPIRATION_OPTIONS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: 'Never' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

const DEFAULT_PERMISSIONS: Record<CollaboratorRole, CollaboratorPermissions> = {
  viewer: { viewPhotos: true, addPhotos: false, addComments: false },
  contributor: { viewPhotos: true, addPhotos: true, addComments: true },
  subcontractor: { viewPhotos: true, addPhotos: true, addComments: true },
};

export function InviteCollaborator({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: InviteCollaboratorProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('viewer');
  const [permissions, setPermissions] = useState<CollaboratorPermissions>(
    DEFAULT_PERMISSIONS.viewer
  );
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [emailError, setEmailError] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setName('');
      setPhone('');
      setRole('viewer');
      setPermissions(DEFAULT_PERMISSIONS.viewer);
      setExpiresInDays(undefined);
      setEmailError('');
    }
  }, [isOpen]);

  // Sync permissions when role changes
  const handleRoleChange = useCallback((newRole: CollaboratorRole) => {
    setRole(newRole);
    setPermissions(DEFAULT_PERMISSIONS[newRole]);
  }, []);

  const handlePermissionToggle = useCallback(
    (key: keyof CollaboratorPermissions) => {
      if (key === 'viewPhotos') return; // viewPhotos is always true
      setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    []
  );

  const validateEmail = (value: string): boolean => {
    if (!value.trim()) {
      setEmailError('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      setEmailError('Enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) return;

    onSubmit({
      email: email.trim(),
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      role,
      permissions,
      expiresInDays,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto">
      <div className="bg-white w-full min-h-screen md:min-h-0 md:max-w-lg md:my-8 md:rounded-xl md:shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:rounded-t-xl">
          <h2 className="text-lg font-semibold">Invite Collaborator</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Email <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              placeholder="collaborator@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) validateEmail(e.target.value);
              }}
              onBlur={() => email && validateEmail(email)}
              error={emailError}
            />
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Name</label>
            <Input
              placeholder="Full name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Phone</label>
            <Input
              type="tel"
              placeholder="Phone number (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Role Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleRoleChange(option.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center transition-colors',
                    role === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-slate-500 leading-tight">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">Permissions</label>
            <div className="space-y-2">
              {/* View Photos - always on */}
              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-not-allowed">
                <input
                  type="checkbox"
                  checked
                  disabled
                  className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-500">View photos</span>
                  <p className="text-xs text-slate-400">Always enabled</p>
                </div>
              </label>

              {/* Add Photos */}
              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.addPhotos}
                  onChange={() => handlePermissionToggle('addPhotos')}
                  className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">Add photos</span>
                  <p className="text-xs text-slate-500">Upload new photos to the project</p>
                </div>
              </label>

              {/* Add Comments */}
              <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.addComments}
                  onChange={() => handlePermissionToggle('addComments')}
                  className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">Add comments</span>
                  <p className="text-xs text-slate-500">Post comments on photos</p>
                </div>
              </label>
            </div>
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Access Expiration</label>
            <select
              value={expiresInDays ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setExpiresInDays(val === '' ? undefined : Number(val));
              }}
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EXPIRATION_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value ?? ''}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              isLoading={isSubmitting}
            >
              Invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
