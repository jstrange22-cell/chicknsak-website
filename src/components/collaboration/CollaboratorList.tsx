import {
  UserPlus,
  Eye,
  Camera,
  MessageCircle,
  Link as LinkIcon,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn, getInitials } from '@/lib/utils';
import type { Collaborator, CollaboratorRole } from '@/types';

interface CollaboratorListProps {
  collaborators: Collaborator[];
  isLoading?: boolean;
  onInvite: () => void;
  onRemove: (id: string) => void;
  onCopyLink: (accessToken: string) => void;
}

const ROLE_COLORS: Record<CollaboratorRole, { bg: string; text: string }> = {
  viewer: { bg: 'bg-slate-100', text: 'text-slate-700' },
  contributor: { bg: 'bg-blue-100', text: 'text-blue-700' },
  subcontractor: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  viewer: 'Viewer',
  contributor: 'Contributor',
  subcontractor: 'Subcontractor',
};

function isExpired(collaborator: Collaborator): boolean {
  if (!collaborator.expiresAt) return false;
  const expiresDate = collaborator.expiresAt.toDate
    ? collaborator.expiresAt.toDate()
    : new Date(collaborator.expiresAt as unknown as string);
  return expiresDate < new Date();
}

function getAvatarInitials(collaborator: Collaborator): string {
  if (collaborator.name) return getInitials(collaborator.name);
  return collaborator.email.charAt(0).toUpperCase();
}

function getAvatarColor(email: string): string {
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-teal-500',
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function CollaboratorList({
  collaborators,
  isLoading = false,
  onInvite,
  onRemove,
  onCopyLink,
}: CollaboratorListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="mt-3 text-sm text-slate-500">Loading collaborators...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Collaborators</h2>
        <Button size="sm" onClick={onInvite}>
          <UserPlus className="h-4 w-4" />
          Invite
        </Button>
      </div>

      {/* List */}
      {collaborators.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 mb-4">
            <UserPlus className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-900">No collaborators yet</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-xs">
            Invite clients, subcontractors, or team members to collaborate on this project.
          </p>
          <Button size="sm" className="mt-4" onClick={onInvite}>
            <UserPlus className="h-4 w-4" />
            Invite Collaborator
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {collaborators.map((collaborator) => {
            const expired = isExpired(collaborator);
            const roleStyle = ROLE_COLORS[collaborator.role];

            return (
              <div
                key={collaborator.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3 transition-colors',
                  expired
                    ? 'border-red-200 bg-red-50/50'
                    : 'border-slate-200 bg-white'
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white',
                    expired ? 'bg-slate-400' : getAvatarColor(collaborator.email)
                  )}
                >
                  {getAvatarInitials(collaborator)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">
                      {collaborator.name || collaborator.email}
                    </span>
                    {expired && (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Expired
                      </span>
                    )}
                  </div>
                  {collaborator.name && (
                    <p className="text-xs text-slate-500 truncate">
                      {collaborator.email}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {/* Role Badge */}
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        roleStyle.bg,
                        roleStyle.text
                      )}
                    >
                      {ROLE_LABELS[collaborator.role]}
                    </span>

                    {/* Permission Icons */}
                    <div className="flex items-center gap-1.5 text-slate-400">
                      {collaborator.permissions.viewPhotos && (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      {collaborator.permissions.addPhotos && (
                        <Camera className="h-3.5 w-3.5" />
                      )}
                      {collaborator.permissions.addComments && (
                        <MessageCircle className="h-3.5 w-3.5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onCopyLink(collaborator.accessToken)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Copy invite link"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(collaborator.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Remove collaborator"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
