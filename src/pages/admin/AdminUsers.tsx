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
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
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
      // Fallback for mobile
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

  // Success state — show the invite link
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
// AdminUsers Component
// ---------------------------------------------------------------------------

export default function AdminUsers() {
  const { user } = useAuthContext();
  const { data: users = [], isLoading } = useCompanyUsers();
  const { data: pendingInvitations = [] } = usePendingInvitations();
  const updateRole = useUpdateUserRole();
  const toggleActive = useToggleUserActive();
  const revokeInvitation = useRevokeInvitation();
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Stats
  const stats = useMemo(() => {
    const active = users.filter((u) => u.isActive).length;
    const inactive = users.filter((u) => !u.isActive).length;
    const admins = users.filter((u) => u.role === 'admin' || u.role === 'manager').length;
    return { total: users.length, active, inactive, admins };
  }, [users]);

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Users</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.active}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Inactive</p>
          <p className="mt-1 text-2xl font-bold text-slate-400">{stats.inactive}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Admins/Managers</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{stats.admins}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Team Members</h2>
        <button
          onClick={() => setShowInviteModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Invite User
        </button>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="h-10 w-10 mb-2" />
            <p className="text-sm">No team members found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.id === user?.uid;
                  const config = roleConfig[u.role];
                  const RoleIcon = config.icon;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt={u.fullName} className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                              {u.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900">{u.fullName}</p>
                            {u.jobTitle && <p className="text-xs text-slate-500">{u.jobTitle}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{u.email}</td>
                      <td className="py-3 px-4">
                        {isSelf ? (
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', config.classes)}>
                            <RoleIcon className="h-3 w-3" />
                            {config.label}
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => updateRole.mutate({ userId: u.id, role: e.target.value as UserRole })}
                            className={cn(
                              'h-7 rounded-lg border-0 text-xs font-medium px-2',
                              config.classes,
                            )}
                          >
                            {roleOptions.map((r) => (
                              <option key={r} value={r}>{roleConfig[r].label}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                            u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs">
                        {u.updatedAt?.toDate?.()
                          ? u.updatedAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                          : '--'}
                      </td>
                      <td className="py-3 px-4">
                        {!isSelf && (
                          <button
                            onClick={() => toggleActive.mutate({ userId: u.id, isActive: !u.isActive })}
                            disabled={toggleActive.isPending}
                            className={cn(
                              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                              u.isActive
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                            )}
                          >
                            {u.isActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Pending Invitations ({pendingInvitations.length})
          </h2>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-200 bg-amber-50 text-left text-xs font-medium text-amber-700 uppercase tracking-wider">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Invited</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {pendingInvitations.map((inv) => {
                    const config = roleConfig[inv.role];
                    const signupLink = `${window.location.origin}/auth/signup?invite=${inv.inviteToken}`;
                    return (
                      <tr key={inv.id} className="bg-white hover:bg-amber-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-600">
                              {inv.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{inv.fullName}</p>
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                                <Clock className="h-3 w-3" /> Pending
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{inv.email}</td>
                        <td className="py-3 px-4">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', config.classes)}>
                            {config.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs">
                          {inv.createdAt?.toDate?.()
                            ? inv.createdAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric' })
                            : '--'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={async () => {
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
                              }}
                              title="Copy invite link"
                              className="rounded-md px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors inline-flex items-center gap-1"
                            >
                              <Link2 className="h-3 w-3" />
                              Copy Link
                            </button>
                            <button
                              onClick={() => revokeInvitation.mutate(inv.id)}
                              disabled={revokeInvitation.isPending}
                              title="Revoke invitation"
                              className="rounded-md px-2 py-1 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors inline-flex items-center gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                              Revoke
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
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && <InviteUserModal onClose={() => setShowInviteModal(false)} />}
    </div>
  );
}
