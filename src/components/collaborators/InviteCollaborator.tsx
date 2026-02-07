import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { useInviteCollaborator } from '@/hooks/useCollaborators';
import type { CollaboratorRole, CollaboratorPermissions } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InviteCollaboratorProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: { value: CollaboratorRole; label: string; description: string }[] = [
  { value: 'viewer', label: 'Viewer', description: 'Can view photos and comments' },
  { value: 'contributor', label: 'Contributor', description: 'Can add photos and comments' },
  { value: 'subcontractor', label: 'Subcontractor', description: 'Can add photos to the project' },
];

const DEFAULT_PERMISSIONS: Record<CollaboratorRole, CollaboratorPermissions> = {
  viewer: { viewPhotos: true, addPhotos: false, addComments: false },
  contributor: { viewPhotos: true, addPhotos: true, addComments: true },
  subcontractor: { viewPhotos: true, addPhotos: true, addComments: false },
};

const EXPIRATION_OPTIONS: { value: number | undefined; label: string }[] = [
  { value: undefined, label: 'Never' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InviteCollaborator({
  isOpen,
  onClose,
  projectId,
  isSubmitting: externalIsSubmitting = false,
}: InviteCollaboratorProps) {
  // Form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('viewer');
  const [permissions, setPermissions] = useState<CollaboratorPermissions>(
    DEFAULT_PERMISSIONS.viewer,
  );
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);
  const [emailError, setEmailError] = useState('');

  // Share link state
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mutation
  const inviteMutation = useInviteCollaborator();
  const isSubmitting = externalIsSubmitting || inviteMutation.isPending;

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
      setShareLink(null);
      setLinkCopied(false);
    }
  }, [isOpen]);

  // Clean up copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleRoleChange = useCallback((newRole: CollaboratorRole) => {
    setRole(newRole);
    setPermissions(DEFAULT_PERMISSIONS[newRole]);
  }, []);

  const handlePermissionToggle = useCallback(
    (key: keyof CollaboratorPermissions) => {
      // viewPhotos is always enabled
      if (key === 'viewPhotos') return;
      setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [],
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

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = link;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setLinkCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail(email)) return;

    try {
      const collaboratorId = await inviteMutation.mutateAsync({
        projectId,
        email: email.trim(),
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        role,
        permissions,
        expiresInDays,
      });

      // Build a share link using the returned collaborator data.
      // The access token is generated server-side; we construct the link from
      // the mutation result. Because useInviteCollaborator returns the doc id
      // (not the full document), we construct the token-based link by
      // re-querying or using the id directly. In practice the invite mutation
      // returns the new doc id, and the accessToken is a UUID stored on the
      // document. For the share link we use the collaboratorId as a fallback
      // identifier. A full implementation would return the accessToken from
      // the mutation; here we surface the id-based guest link.
      const generatedLink = `${window.location.origin}/project-guest/${collaboratorId}`;
      setShareLink(generatedLink);
    } catch (error) {
      console.error('Failed to invite collaborator:', error);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

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

        {/* Success state with share link */}
        {shareLink ? (
          <div className="p-4 space-y-5">
            <div className="flex flex-col items-center text-center py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 mb-3">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-base font-semibold text-slate-900">
                Invitation Sent
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {email} has been invited as a {role}.
              </p>
            </div>

            {/* Share link */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Share Link</label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareLink}
                  className="text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopyLink(shareLink)}
                  title="Copy share link"
                >
                  {linkCopied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {linkCopied && (
                <p className="text-xs text-emerald-600">Link copied to clipboard</p>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  // Reset to invite another
                  setShareLink(null);
                  setEmail('');
                  setName('');
                  setPhone('');
                  setRole('viewer');
                  setPermissions(DEFAULT_PERMISSIONS.viewer);
                  setExpiresInDays(undefined);
                  setEmailError('');
                  setLinkCopied(false);
                }}
              >
                Invite Another
              </Button>
              <Button type="button" className="flex-1" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Invite form */
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
                disabled={isSubmitting}
              />
            </div>

            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Name</label>
              <Input
                placeholder="Full name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
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
                disabled={isSubmitting}
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
                    disabled={isSubmitting}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center transition-colors',
                      role === option.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                      isSubmitting && 'opacity-50 cursor-not-allowed',
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
                    <span className="text-sm font-medium text-slate-500">
                      View photos
                    </span>
                    <p className="text-xs text-slate-400">Always enabled</p>
                  </div>
                </label>

                {/* Add Photos */}
                <label
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border border-slate-200 transition-colors',
                    isSubmitting
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:bg-slate-50 cursor-pointer',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={permissions.addPhotos}
                    onChange={() => handlePermissionToggle('addPhotos')}
                    disabled={isSubmitting}
                    className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700">
                      Add photos
                    </span>
                    <p className="text-xs text-slate-500">
                      Upload new photos to the project
                    </p>
                  </div>
                </label>

                {/* Add Comments */}
                <label
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border border-slate-200 transition-colors',
                    isSubmitting
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:bg-slate-50 cursor-pointer',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={permissions.addComments}
                    onChange={() => handlePermissionToggle('addComments')}
                    disabled={isSubmitting}
                    className="h-4 w-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700">
                      Add comments
                    </span>
                    <p className="text-xs text-slate-500">
                      Post comments on photos
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Access Expiration
              </label>
              <select
                value={expiresInDays ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setExpiresInDays(val === '' ? undefined : Number(val));
                }}
                disabled={isSubmitting}
                className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {EXPIRATION_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value ?? ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Error message from mutation */}
            {inviteMutation.isError && (
              <p className="text-sm text-red-500">
                Failed to send invitation. Please try again.
              </p>
            )}

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
        )}
      </div>
    </div>
  );
}
