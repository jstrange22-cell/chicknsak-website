import { useState, useEffect } from 'react';
import {
  UsersRound,
  Plus,
  X,
  Loader2,
  Pencil,
  Trash2,
  Check,
  Search,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { UserGroup, User } from '@/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Colors for group avatar backgrounds
const GROUP_COLORS = [
  'bg-blue-100 text-blue-600',
  'bg-purple-100 text-purple-600',
  'bg-green-100 text-green-600',
  'bg-amber-100 text-amber-600',
  'bg-rose-100 text-rose-600',
  'bg-cyan-100 text-cyan-600',
  'bg-indigo-100 text-indigo-600',
  'bg-teal-100 text-teal-600',
];

function getGroupColor(index: number): string {
  return GROUP_COLORS[index % GROUP_COLORS.length];
}

export default function UserGroupsPage() {
  const { profile, user } = useAuthContext();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [modalMemberIds, setModalMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Delete confirmation
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager' || !profile?.role;

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.companyId]);

  async function loadData() {
    if (!profile?.companyId) {
      setIsLoading(false);
      return;
    }
    try {
      // Load groups and users in parallel
      const [groupsSnap, usersSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'userGroups'),
            where('companyId', '==', profile.companyId)
          )
        ),
        getDocs(
          query(
            collection(db, 'users'),
            where('companyId', '==', profile.companyId)
          )
        ),
      ]);

      const groupList = groupsSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as UserGroup
      );
      groupList.sort((a, b) => a.name.localeCompare(b.name));
      setGroups(groupList);

      const userList = usersSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as User
      );
      userList.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setCompanyUsers(userList.filter((u) => u.isActive));
    } catch (err) {
      console.error('Error loading data:', err);
    }
    setIsLoading(false);
  }

  function openCreateModal() {
    setEditingGroup(null);
    setModalName('');
    setModalDescription('');
    setModalMemberIds([]);
    setMemberSearch('');
    setModalError('');
    setShowModal(true);
  }

  function openEditModal(group: UserGroup) {
    setEditingGroup(group);
    setModalName(group.name);
    setModalDescription(group.description || '');
    setModalMemberIds([...group.memberIds]);
    setMemberSearch('');
    setModalError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingGroup(null);
    setModalError('');
  }

  function toggleMember(userId: string) {
    setModalMemberIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  }

  async function handleSaveGroup() {
    if (!modalName.trim()) {
      setModalError('Group name is required.');
      return;
    }
    if (!profile?.companyId || !user) return;

    setIsSaving(true);
    setModalError('');
    try {
      if (editingGroup) {
        // Update existing group
        await updateDoc(doc(db, 'userGroups', editingGroup.id), {
          name: modalName.trim(),
          description: modalDescription.trim() || null,
          memberIds: modalMemberIds,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new group
        await addDoc(collection(db, 'userGroups'), {
          companyId: profile.companyId,
          name: modalName.trim(),
          description: modalDescription.trim() || null,
          memberIds: modalMemberIds,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      closeModal();
      await loadData();
    } catch (err) {
      console.error('Error saving group:', err);
      setModalError('Failed to save group. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'userGroups', groupId));
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setDeletingGroupId(null);
    } catch (err) {
      console.error('Error deleting group:', err);
    } finally {
      setIsDeleting(false);
    }
  }

  // Helper to get user name by id
  function getUserById(userId: string): User | undefined {
    return companyUsers.find((u) => u.id === userId);
  }

  // Filtered users for member selection in the modal
  const filteredUsers = companyUsers.filter((u) =>
    memberSearch
      ? u.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(memberSearch.toLowerCase())
      : true
  );

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-48px)]">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">User Groups</h1>
        <p className="text-slate-500 text-sm mb-6">
          Create and manage groups for streamlined project assignment.
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
          <h1 className="text-3xl font-bold text-slate-900 mb-1">
            User Groups
          </h1>
          <p className="text-slate-500 text-sm">
            {groups.length} group{groups.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            Create Group
          </Button>
        )}
      </div>

      {/* Groups List */}
      {groups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg border border-slate-200 py-20">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <UsersRound className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No Groups Yet
          </h3>
          <p className="text-sm text-slate-500 max-w-[280px] text-center leading-relaxed mb-4">
            Organize your team into groups for easier project assignment.
          </p>
          {isAdmin && (
            <Button size="sm" onClick={openCreateModal}>
              <Plus className="w-4 h-4" />
              Create Your First Group
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group, index) => (
            <div
              key={group.id}
              className="bg-white rounded-lg border border-slate-200 p-5 flex flex-col"
            >
              {/* Group Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
                      getGroupColor(index)
                    )}
                  >
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">
                      {group.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {group.memberIds.length} member
                      {group.memberIds.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(group)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Edit group"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingGroupId(group.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete group"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                )}
              </div>

              {/* Description */}
              {group.description && (
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">
                  {group.description}
                </p>
              )}

              {/* Member Avatars */}
              {group.memberIds.length > 0 && (
                <div className="flex items-center mt-auto pt-3 border-t border-slate-100">
                  <div className="flex -space-x-2">
                    {group.memberIds.slice(0, 5).map((memberId) => {
                      const member = getUserById(memberId);
                      if (!member) return null;
                      return member.avatarUrl ? (
                        <img
                          key={memberId}
                          src={member.avatarUrl}
                          alt={member.fullName}
                          title={member.fullName}
                          className="w-7 h-7 rounded-full border-2 border-white object-cover"
                        />
                      ) : (
                        <div
                          key={memberId}
                          title={member.fullName}
                          className="w-7 h-7 rounded-full border-2 border-white bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-semibold"
                        >
                          {getInitials(member.fullName)}
                        </div>
                      );
                    })}
                    {group.memberIds.length > 5 && (
                      <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-semibold">
                        +{group.memberIds.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingGroup ? 'Edit Group' : 'Create Group'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {modalError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="e.g. Deck Crew, Site Inspectors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] resize-none"
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  placeholder="What is this group for?"
                />
              </div>

              {/* Member Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Members ({modalMemberIds.length} selected)
                </label>

                {/* Search */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    className="w-full h-10 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    placeholder="Search team members..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                  />
                </div>

                {/* User List */}
                <div className="border border-slate-200 rounded-lg max-h-[200px] overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                      No users found.
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelected = modalMemberIds.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggleMember(u.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0',
                            isSelected && 'bg-blue-50'
                          )}
                        >
                          {/* Checkbox */}
                          <div
                            className={cn(
                              'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                              isSelected
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-slate-300'
                            )}
                          >
                            {isSelected && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>

                          {/* Avatar */}
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.fullName}
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                              {getInitials(u.fullName)}
                            </div>
                          )}

                          {/* Name & Email */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {u.fullName}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {u.email}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveGroup}
                disabled={isSaving || !modalName.trim()}
                isLoading={isSaving}
              >
                {isSaving
                  ? 'Saving...'
                  : editingGroup
                    ? 'Save Changes'
                    : 'Create Group'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingGroupId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                Delete Group
              </h2>
              <p className="text-sm text-slate-500">
                Are you sure you want to delete this group? This action cannot be
                undone. Members will not be removed from the company.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingGroupId(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteGroup(deletingGroupId)}
                disabled={isDeleting}
                isLoading={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Group'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
