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
import type { User as UserType, UserRole } from '@/types';

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

function useInviteUser() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuthContext();

  return useMutation({
    mutationFn: async (data: { email: string; fullName: string; role: UserRole }) => {
      if (!profile?.companyId || !user?.uid) throw new Error('Not authenticated');

      const userData = {
        companyId: profile.companyId,
        email: data.email,
        fullName: data.fullName,
        role: data.role,
        isActive: true,
        avatarUrl: null,
        phone: null,
        jobTitle: null,
        notificationSettings: {
          email: true,
          push: true,
          sms: false,
          photoUploads: true,
          comments: true,
          mentions: true,
          taskAssignments: true,
        },
        settings: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'users'), userData);

      await logActivity({
        companyId: profile.companyId,
        userId: user.uid,
        activityType: 'user_joined',
        message: `${profile.fullName} invited ${data.fullName} (${data.email})`,
        entityType: 'user',
        entityId: docRef.id,
      });

      return { id: docRef.id, ...userData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !fullName.trim()) return;

    try {
      await inviteUser.mutateAsync({ email: email.trim(), fullName: fullName.trim(), role });
      onClose();
    } catch (err) {
      console.error('Failed to invite user:', err);
    }
  };

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
              Send Invite
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
  const updateRole = useUpdateUserRole();
  const toggleActive = useToggleUserActive();
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

      {/* Invite Modal */}
      {showInviteModal && <InviteUserModal onClose={() => setShowInviteModal(false)} />}
    </div>
  );
}
