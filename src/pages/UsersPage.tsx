import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  X,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Eye,
  MoreVertical,
  Mail,
  UserCheck,
  UserX,
  ChevronDown,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { User, UserRole } from '@/types';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'standard', label: 'Standard' },
  { value: 'limited', label: 'Limited' },
];

function getRoleBadgeStyle(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'bg-purple-100 text-purple-700';
    case 'manager':
      return 'bg-blue-100 text-blue-700';
    case 'standard':
      return 'bg-slate-100 text-slate-700';
    case 'limited':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function getRoleIcon(role: UserRole) {
  switch (role) {
    case 'admin':
      return <ShieldAlert className="w-3 h-3" />;
    case 'manager':
      return <ShieldCheck className="w-3 h-3" />;
    case 'standard':
      return <Shield className="w-3 h-3" />;
    case 'limited':
      return <Eye className="w-3 h-3" />;
    default:
      return <Shield className="w-3 h-3" />;
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function UsersPage() {
  const { profile, user } = useAuthContext();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [actionMenuUserId, setActionMenuUserId] = useState<string | null>(null);
  const [editingRoleUserId, setEditingRoleUserId] = useState<string | null>(null);

  // Invite form state
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('standard');
  const [inviteJobTitle, setInviteJobTitle] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

  const isAdmin = profile?.role === 'admin' || !profile?.role;

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.companyId]);

  async function loadUsers() {
    if (!profile?.companyId) {
      setIsLoading(false);
      return;
    }
    try {
      const q = query(
        collection(db, 'users'),
        where('companyId', '==', profile.companyId)
      );
      const snapshot = await getDocs(q);
      const userList = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as User
      );
      // Sort: active first, then alphabetically
      userList.sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.fullName.localeCompare(b.fullName);
      });
      setUsers(userList);
    } catch (err) {
      console.error('Error loading users:', err);
    }
    setIsLoading(false);
  }

  async function handleInviteUser() {
    if (!inviteFullName.trim() || !inviteEmail.trim()) {
      setInviteError('Full name and email are required.');
      return;
    }
    if (!profile?.companyId || !user) return;

    setIsInviting(true);
    setInviteError('');
    try {
      const normalizedEmail = inviteEmail.trim().toLowerCase();

      // Check for duplicate: email already in company users
      const existingUserQuery = query(
        collection(db, 'users'),
        where('companyId', '==', profile.companyId),
        where('email', '==', normalizedEmail)
      );
      const existingSnap = await getDocs(existingUserQuery);
      if (!existingSnap.empty) {
        setInviteError('A user with this email already exists in your company.');
        setIsInviting(false);
        return;
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
        setInviteError('A pending invitation already exists for this email.');
        setIsInviting(false);
        return;
      }

      // Get company name
      let companyName = 'Your Company';
      try {
        const companyDoc = await getDoc(doc(db, 'companies', profile.companyId));
        if (companyDoc.exists()) {
          companyName = companyDoc.data().name || companyName;
        }
      } catch { /* use default */ }

      const inviteToken = crypto.randomUUID();

      await addDoc(collection(db, 'invitations'), {
        companyId: profile.companyId,
        companyName,
        email: normalizedEmail,
        fullName: inviteFullName.trim(),
        role: inviteRole,
        invitedBy: user.uid,
        status: 'pending',
        inviteToken,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Show the signup link
      setInviteLink(`${window.location.origin}/auth/signup?invite=${inviteToken}`);
    } catch (err) {
      console.error('Error inviting user:', err);
      setInviteError('Failed to invite user. Please try again.');
    } finally {
      setIsInviting(false);
    }
  }

  async function handleUpdateRole(userId: string, newRole: UserRole) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setEditingRoleUserId(null);
    } catch (err) {
      console.error('Error updating role:', err);
    }
  }

  async function handleToggleActive(userId: string, currentlyActive: boolean) {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isActive: !currentlyActive,
        updatedAt: serverTimestamp(),
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isActive: !currentlyActive } : u
        )
      );
      setActionMenuUserId(null);
    } catch (err) {
      console.error('Error toggling user active status:', err);
    }
  }

  const activeCount = users.filter((u) => u.isActive).length;

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-48px)]">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Users</h1>
        <p className="text-slate-500 text-sm mb-6">
          Manage team members and control access across your organization.
        </p>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Users</h1>
          <p className="text-slate-500 text-sm">
            {activeCount} active member{activeCount !== 1 ? 's' : ''} of{' '}
            {users.length} total
          </p>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => setShowInviteModal(true)}
          >
            <Plus className="w-4 h-4" />
            Invite User
          </Button>
        )}
      </div>

      {/* User List */}
      {users.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg border border-slate-200 py-20">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Users className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No Team Members Yet
          </h3>
          <p className="text-sm text-slate-500 max-w-[280px] text-center leading-relaxed mb-4">
            Invite your team to start collaborating on projects.
          </p>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowInviteModal(true)}>
              <Plus className="w-4 h-4" />
              Invite Your First User
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <div
              key={u.id}
              className={cn(
                'bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4 transition-colors',
                !u.isActive && 'opacity-60'
              )}
            >
              {/* Avatar */}
              <div className="flex-shrink-0">
                {u.avatarUrl ? (
                  <img
                    src={u.avatarUrl}
                    alt={u.fullName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                    {getInitials(u.fullName)}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900 truncate">
                    {u.fullName}
                  </p>
                  {u.id === user?.uid && (
                    <span className="text-xs text-slate-400">(You)</span>
                  )}
                  {!u.isActive && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-sm text-slate-500 truncate flex items-center gap-1">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    {u.email}
                  </span>
                  {u.jobTitle && (
                    <span className="text-sm text-slate-400 truncate hidden sm:inline">
                      {u.jobTitle}
                    </span>
                  )}
                </div>
              </div>

              {/* Role Badge */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {isAdmin && editingRoleUserId === u.id ? (
                  <div className="relative">
                    <select
                      className="appearance-none bg-white border border-slate-300 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={u.role}
                      onChange={(e) =>
                        handleUpdateRole(u.id, e.target.value as UserRole)
                      }
                      onBlur={() => setEditingRoleUserId(null)}
                      autoFocus
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      isAdmin ? setEditingRoleUserId(u.id) : undefined
                    }
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                      getRoleBadgeStyle(u.role),
                      isAdmin && 'cursor-pointer hover:opacity-80'
                    )}
                    title={isAdmin ? 'Click to change role' : undefined}
                  >
                    {getRoleIcon(u.role)}
                    {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                  </button>
                )}

                {/* Actions Menu */}
                {isAdmin && u.id !== user?.uid && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() =>
                        setActionMenuUserId(
                          actionMenuUserId === u.id ? null : u.id
                        )
                      }
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                    {actionMenuUserId === u.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setActionMenuUserId(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-20 min-w-[160px]">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u.id, u.isActive)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                          >
                            {u.isActive ? (
                              <>
                                <UserX className="w-4 h-4 text-red-500" />
                                <span className="text-red-600">Deactivate</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4 text-green-500" />
                                <span className="text-green-600">Activate</span>
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success state — show the invite link */}
            {inviteLink ? (
              <>
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Invitation Created
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteLink('');
                      setInviteFullName('');
                      setInviteEmail('');
                      setInviteRole('standard');
                      setInviteJobTitle('');
                      loadUsers();
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                    <p className="text-sm font-medium text-emerald-800">
                      Invitation created for {inviteFullName}!
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                      Share this signup link with them via text, email, or WhatsApp.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Signup Link
                    </label>
                    <div className="flex items-stretch gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inviteLink}
                        className="flex-1 h-10 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs text-slate-600"
                      />
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(inviteLink);
                          } catch {
                            const input = document.createElement('textarea');
                            input.value = inviteLink;
                            document.body.appendChild(input);
                            input.select();
                            document.execCommand('copy');
                            document.body.removeChild(input);
                          }
                          setInviteLinkCopied(true);
                          setTimeout(() => setInviteLinkCopied(false), 2000);
                        }}
                        className={cn(
                          "h-10 px-3 rounded-lg text-sm font-medium inline-flex items-center gap-1.5 transition-colors",
                          inviteLinkCopied
                            ? "bg-emerald-500 text-white"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                        )}
                      >
                        {inviteLinkCopied ? '✓ Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteLink('');
                      setInviteFullName('');
                      setInviteEmail('');
                      setInviteRole('standard');
                      setInviteJobTitle('');
                      loadUsers();
                    }}
                  >
                    Done
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Invite Team Member
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteError('');
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 space-y-4">
                  {inviteError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                      {inviteError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={inviteFullName}
                      onChange={(e) => setInviteFullName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      type="email"
                      placeholder="john@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Role
                    </label>
                    <div className="relative">
                      <select
                        className="w-full h-12 appearance-none bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as UserRole)}
                      >
                        {ROLE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Job Title
                    </label>
                    <Input
                      value={inviteJobTitle}
                      onChange={(e) => setInviteJobTitle(e.target.value)}
                      placeholder="e.g. Project Manager"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteError('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleInviteUser}
                    disabled={isInviting || !inviteFullName.trim() || !inviteEmail.trim()}
                    isLoading={isInviting}
                  >
                    {isInviting ? 'Creating...' : 'Create Invite'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
