import { useState, useEffect } from 'react';
import { Loader2, UserPlus, Mail } from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn, getInitials } from '@/lib/utils';
import type { User, UserRole } from '@/types';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'standard', label: 'Standard' },
  { value: 'limited', label: 'Limited' },
];

const roleBadgeColors: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  standard: 'bg-slate-100 text-slate-700',
  limited: 'bg-gray-100 text-gray-500',
};

export function TeamManagement() {
  const { profile } = useAuthContext();
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    async function loadMembers() {
      if (!profile?.companyId) {
        setIsLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, 'users'),
          where('companyId', '==', profile.companyId)
        );
        const snap = await getDocs(q);
        setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as User)));
      } catch (err) {
        console.error('Error loading team:', err);
      }
      setIsLoading(false);
    }
    loadMembers();
  }, [profile?.companyId]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, role: newRole } : m))
      );
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isActive,
        updatedAt: serverTimestamp(),
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, isActive } : m))
      );
    } catch (err) {
      console.error('Error toggling active:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Invite */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{members.length} team member{members.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setShowInvite(!showInvite)}>
          <UserPlus className="w-4 h-4 mr-1" />
          Invite
        </Button>
      </div>

      {showInvite && (
        <div className="bg-blue-50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-blue-900">Invite a team member</p>
          <div className="flex gap-2">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@company.com"
              type="email"
              className="flex-1"
            />
            <Button size="sm" disabled={!inviteEmail}>
              <Mail className="w-4 h-4 mr-1" />
              Send
            </Button>
          </div>
          <p className="text-xs text-blue-600">Invite functionality requires Firebase Auth invite setup</p>
        </div>
      )}

      {/* Member list */}
      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className={cn(
              "flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100",
              !member.isActive && "opacity-50"
            )}
          >
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt={member.fullName} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                {getInitials(member.fullName)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{member.fullName}</p>
              <p className="text-xs text-slate-500 truncate">{member.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={member.role}
                onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                className={cn(
                  "text-xs font-medium px-2 py-1 rounded-full border-0 appearance-none cursor-pointer",
                  roleBadgeColors[member.role]
                )}
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => handleToggleActive(member.id, !member.isActive)}
                className={cn(
                  "w-10 h-6 rounded-full transition-colors relative",
                  member.isActive ? "bg-green-500" : "bg-slate-300"
                )}
              >
                <div className={cn(
                  "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                  member.isActive ? "left-4" : "left-0.5"
                )} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
