import { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Loader2,
  X,
  Shield,
  ShieldCheck,
  UserCog,
  Eye,
  Copy,
  Check,
  Clock,
  Link2,
  Trash2,
  MoreVertical,
  UserX,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';
import type { User as UserType, UserRole, Invitation } from '@/types';

// ---------------------------------------------------------------------------
// Role configuration
// ---------------------------------------------------------------------------

const roleConfig: Record<UserRole, { label: string; icon: React.ElementType; classes: string }> = {
  admin: { label: 'Admin', icon: Shield, classes: 'bg-purple-100 text-purple-700' },
  manager: { label: 'Manager', icon: ShieldCheck, classes: 'bg-blue-100 text-blue-700' },
  standard: { label: 'Standard', icon: UserCog, classes: 'bg-slate-100 text-slate-700' },
  limited: { label: 'Limited', icon: Eye, classes: 'bg-amber-100 text-amber-700' },
};

const roleOptions: UserRole[] = ['admin', 'manager', 'standard', 'limited'];

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useCompanyUsers() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ['admin', 'users', companyId],
    queryFn: async (): Promise<UserType[]> => {
      if (!companyId) return [];

      const q = query(
        collection(db, 'users'),
        where('companyId', '==', companyId),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserType));
    },
    enabled: !!companyId,
  });
}

function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      if (!profile?.companyId || !user?.uid) throw new Error('Not authenticated');

      await updateDoc(doc(db, 'users', userId), {
        role,
        updatedAt: serverTimestamp(),
      });

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'user_joined',
        message: `${profile.fullName} changed a user's role to ${role}`,
        entityType: 'user',
        entityId: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

function useToggleUserActive() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      if (!profile?.companyId || !user?.uid) throw new Error('Not authenticated');

      await updateDoc(doc(db, 'users', userId), {
        isActive,
        updatedAt: serverTimestamp(),
      });

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'user_joined',
        message: `${profile.fullName} ${isActive ? 'reactivated' : 'deactivated'} a user`,
        entityType: 'user',
        entityId: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

function useDeleteUser() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async ({ userId, userName }: { userId: string; userName: string }) => {
      if (!profile?.companyId || !user?.uid) throw new Error('Not authenticated');

      await deleteDoc(doc(db, 'users', userId));

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'user_joined',
        message: `${profile.fullName} removed ${userName} from the company`,
        entityType: 'user',
        entityId: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

function usePendingInvitations() {
  const { profile } = useAuthContext();
  const companyId = profile?.companyId;

  return useQuery({
    queryKey: ['admin', 'invitations', companyId],
    queryFn: async (): Promise<Invitation[]> => {
      if (!companyId) return [];
      const q = query(
        collection(db, 'invitations'),
        where('companyId', '==', companyId),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invitation));
    },
    enabled: !!companyId,
  });
}

function useInviteUser() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: { email: string; fullName: string; role: UserRole }) => {
      if (!profile?.companyId || !user?.uid) throw new Error('Not authenticated');

      const normalizedEmail = data.email.toLowerCase().trim();

      // Check for duplicate: email already in company users
      const existingUserQuery = query(
        collection(db, 'users'),
        where('companyId', '==', profile.companyId),
        where('email', '==', normalizedEmail)
      );
      const existingSnap = await getDocs(existingUserQuery);
      if (!existingSnap.empty) {
        throw new Error('A user with this email already exists in your company.');
      }

      // Check for duplicate pending invitation
      const existingInviteQuery = query(
        collection(db, 'invitations'),
        where('companyId', '==', profile.companyId),
        where('email', '==', normalizedEmail),
        where('status', '==', 'pending')
      );
      const existingInviteSnap = await getDocs(existingInviteQuery);
      if (!existingInviteSnap.empty) {
        throw new Error('A pending invitation already exists for this email.');
      }

      // Get company name for the invitation context
      let companyName = 'Your Company';
      try {
        const companyDoc = await getDoc(doc(db, 'companies', profile.companyId));
        if (companyDoc.exists()) {
          companyName = companyDoc.data().name || companyName;
        }
      } catch {
        // Use default
      }

      const inviteToken = crypto.randomUUID();

      const invitationData = {
        companyId: profile.companyId,
        companyName,
        email: normalizedEmail,
        fullName: data.fullName,
        role: data.role,
        invitedBy: user.uid,
        status: 'pending',
        inviteToken,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'invitations'), invitationData);

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'collaborator_invited',
        message: `${profile.fullName} invited ${data.fullName} (${normalizedEmail})`,
        entityType: 'invitation',
        entityId: docRef.id,
      });

      const signupLink = `${window.location.origin}/auth/signup?invite=${inviteToken}`;

      return { id: docRef.id, inviteToken, signupLink };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'invitations'] });
    },
  });
}

function useRevokeInvitation() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      if (!profile?.companyId || !user?.uid) throw new Error('Not authenticated');

      await updateDoc(doc(db, 'invitations', invitationId), {
        status: 'revoked',
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'invitations'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Confirm Delete Modal
// ---------------------------------------------------------------------------

function ConfirmDeleteModal({
  userName,
  onConfirm,
  onCancel,
  isPending,
}: {
  userName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="p-5 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Delete User</h3>
          <p className="text-sm text-slate-500">
            Are you sure you want to remove <span className="font-medium text-slate-700">{userName}</span> from your company? This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 p-4 border-t border-slate-200">
          <button
            onClick={onCancel}
            className="flex-1 h-10 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 h-10 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invite User Modal
// ---------------------------------------------------------------------------

interface InviteModalProps {
  onClose: () => void;
}

function InviteUserModal({ onClose }: InviteModalProps) {
  const inviteUser = useInviteUser();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('standard');
  const [signupLink, setSignupLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) return;
    setErrorMsg('');

    try {
      const result = await inviteUser.mutateAsync({ email: email.trim(), fullName: fullName.trim(), role });
      setSignupLink(result.signupLink);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to invite user.';
      setErrorMsg(msg);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(signupLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('textarea');
      input.value = signupLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Success state
  if (signupLink) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-lg font-semibold text-slate-900">Invitation Created</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
              <p className="text-sm font-medium text-emerald-800">
                Invitation sent for {fullName}!
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                Share this signup link with them via text, email, or WhatsApp.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Signup Link</label>
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  readOnly
                  value={signupLink}
                  className="flex-1 h-10 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs text-slate-600 focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className={cn(
                    "h-10 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 transition-colors",
                    copied
                      ? "bg-emerald-500 text-white"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  )}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-semibold text-slate-900">Invite New User</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Smith"
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@company.com"
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>{roleConfig[r].label}</option>
              ))}
            </select>
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
              disabled={inviteUser.isPending}
              className="flex-1 h-10 rounded-lg bg-blue-500 text-sm font-medium text-white hover:bg-blue-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {inviteUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Card (mobile-friendly)
// ---------------------------------------------------------------------------

function UserCard({
  u,
  isSelf,
  onUpdateRole,
  onToggleActive,
  onDelete,
}: {
  u: UserType;
  isSelf: boolean;
  onUpdateRole: (userId: string, role: UserRole) => void;
  onToggleActive: (userId: string, isActive: boolean) => void;
  onDelete: (userId: string, userName: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const config = roleConfig[u.role];
  const RoleIcon = config.icon;

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors',
        !u.isActive && 'opacity-60'
      )}
    >
      {/* Top row: avatar + name + actions */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {u.avatarUrl ? (
            <img src={u.avatarUrl} alt={u.fullName} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
              {u.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
          )}
        </div>

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-slate-900 truncate">{u.fullName}</p>
            {isSelf && <span className="text-xs text-slate-400">(You)</span>}
            {!u.isActive && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                Inactive
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 truncate">{u.email}</p>
          {u.jobTitle && <p className="text-xs text-slate-400 mt-0.5">{u.jobTitle}</p>}
        </div>

        {/* Action button */}
        {!isSelf && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <MoreVertical className="h-4 w-4 text-slate-400" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-20 min-w-[170px]">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setEditingRole(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Shield className="h-4 w-4 text-slate-400" />
                    Change Role
                  </button>
                  <button
                    onClick={() => {
                      onToggleActive(u.id, !u.isActive);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                  >
                    {u.isActive ? (
                      <>
                        <UserX className="h-4 w-4 text-amber-500" />
                        <span className="text-amber-700">Deactivate</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 text-emerald-500" />
                        <span className="text-emerald-700">Reactivate</span>
                      </>
                    )}
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={() => {
                      onDelete(u.id, u.fullName);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete User
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom row: role badge + status */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {editingRole && !isSelf ? (
          <select
            value={u.role}
            autoFocus
            onChange={(e) => {
              onUpdateRole(u.id, e.target.value as UserRole);
              setEditingRole(false);
            }}
            onBlur={() => setEditingRole(false)}
            className="h-7 rounded-lg border border-slate-300 text-xs font-medium px-2 bg-white"
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>{roleConfig[r].label}</option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onClick={() => !isSelf && setEditingRole(true)}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
              config.classes,
              !isSelf && 'cursor-pointer hover:opacity-80'
            )}
            title={!isSelf ? 'Click to change role' : undefined}
          >
            <RoleIcon className="h-3 w-3" />
            {config.label}
          </button>
        )}

        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
          )}
        >
          {u.isActive ? 'Active' : 'Inactive'}
        </span>

        {u.updatedAt?.toDate?.() && (
          <span className="text-xs text-slate-400 ml-auto">
            {u.updatedAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending Invitation Card (mobile-friendly)
// ---------------------------------------------------------------------------

function InvitationCard({
  inv,
  onRevoke,
  isRevoking,
}: {
  inv: Invitation;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const config = roleConfig[inv.role];
  const signupLink = `${window.location.origin}/auth/signup?invite=${inv.inviteToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(signupLink);
    } catch {
      const input = document.createElement('textarea');
      input.value = signupLink;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-600 flex-shrink-0">
          {inv.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 truncate">{inv.fullName}</p>
          <p className="text-sm text-slate-500 truncate">{inv.email}</p>
        </div>

        {/* Status indicator */}
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium flex-shrink-0">
          <Clock className="h-3 w-3" /> Pending
        </span>
      </div>

      {/* Bottom: role + date + actions */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', config.classes)}>
          {config.label}
        </span>
        {inv.createdAt?.toDate?.() && (
          <span className="text-xs text-slate-400">
            Invited {inv.createdAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-medium inline-flex items-center gap-1 transition-colors",
              copied
                ? "bg-emerald-100 text-emerald-700"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100"
            )}
          >
            {copied ? <Check className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button
            onClick={() => onRevoke(inv.id)}
            disabled={isRevoking}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            Revoke
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminUsers Component
// ---------------------------------------------------------------------------

export default function AdminUsers() {
  const { user } = useAuthContext();
  const { data: users = [], isLoading } = useCompanyUsers();
  const { data: pendingInvitations = [] } = usePendingInvitations();
  const updateRole = useUpdateUserRole();
  const toggleActive = useToggleUserActive();
  const deleteUser = useDeleteUser();
  const revokeInvitation = useRevokeInvitation();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Stats
  const stats = useMemo(() => {
    const active = users.filter((u) => u.isActive).length;
    const inactive = users.filter((u) => !u.isActive).length;
    const admins = users.filter((u) => u.role === 'admin' || u.role === 'manager').length;
    return { total: users.length, active, inactive, admins, pending: pendingInvitations.length };
  }, [users, pendingInvitations]);

  return (
    <div>
      {/* Summary Cards — 2-column grid that fits mobile without scrolling */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Total</p>
          <p className="text-xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Active</p>
          <p className="text-xl font-bold text-emerald-600">{stats.active}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Inactive</p>
          <p className="text-xl font-bold text-slate-400">{stats.inactive}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Pending</p>
          <p className="text-xl font-bold text-amber-500">{stats.pending}</p>
        </div>
      </div>

      {/* Header + Invite button */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Team Members</h2>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Invite
        </button>
      </div>

      {/* Users — card list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-slate-200 bg-white">
          <Users className="h-10 w-10 text-slate-300 mb-2" />
          <p className="text-sm text-slate-400">No team members found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <UserCard
              key={u.id}
              u={u}
              isSelf={u.id === user?.uid}
              onUpdateRole={(userId, role) => updateRole.mutate({ userId, role })}
              onToggleActive={(userId, isActive) => toggleActive.mutate({ userId, isActive })}
              onDelete={(userId, userName) => setDeleteTarget({ id: userId, name: userName })}
            />
          ))}
        </div>
      )}

      {/* Pending Invitations — card list */}
      {pendingInvitations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Pending Invitations ({pendingInvitations.length})
          </h2>
          <div className="space-y-3">
            {pendingInvitations.map((inv) => (
              <InvitationCard
                key={inv.id}
                inv={inv}
                onRevoke={(id) => revokeInvitation.mutate(id)}
                isRevoking={revokeInvitation.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          userName={deleteTarget.name}
          isPending={deleteUser.isPending}
          onConfirm={() => {
            deleteUser.mutate(
              { userId: deleteTarget.id, userName: deleteTarget.name },
              { onSuccess: () => setDeleteTarget(null) }
            );
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && <InviteUserModal onClose={() => setShowInviteModal(false)} />}
    </div>
  );
}
