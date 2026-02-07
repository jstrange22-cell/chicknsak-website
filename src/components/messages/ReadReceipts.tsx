import { useMemo } from 'react';
import { cn, getInitials } from '@/lib/utils';
import { useAuthContext } from '@/components/auth/AuthProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReadReceiptsProps {
  readBy?: string[];
  isCurrentUser: boolean;
  members: Array<{ id: string; fullName: string; avatarUrl?: string }>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReadReceipts({
  readBy,
  isCurrentUser,
  members,
}: ReadReceiptsProps) {
  const { user } = useAuthContext();

  // Get member details for users who have read the message (excluding sender)
  const readers = useMemo(() => {
    if (!readBy || readBy.length === 0) return [];
    return readBy
      .filter((uid) => uid !== user?.uid)
      .map((uid) => {
        const member = members.find((m) => m.id === uid);
        return member ?? { id: uid, fullName: 'Unknown', avatarUrl: undefined };
      });
  }, [readBy, members, user?.uid]);

  // Only show read receipts for messages sent by the current user
  if (!isCurrentUser) return null;

  // If nobody else has read it, show a single check
  if (readers.length === 0) {
    return (
      <div className="flex items-center justify-end mt-0.5">
        <svg
          className="h-3.5 w-3.5 text-slate-300"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 8.5 L6 12.5 L14 4.5" />
        </svg>
      </div>
    );
  }

  // Show double check (read) icon plus avatars
  return (
    <div className="flex items-center justify-end gap-1 mt-0.5">
      {/* Double check icon (read) */}
      <svg
        className="h-3.5 w-3.5 text-blue-500 shrink-0"
        viewBox="0 0 20 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2 8.5 L6 12.5 L14 4.5" />
        <path d="M6 8.5 L10 12.5 L18 4.5" />
      </svg>

      {/* Reader avatars */}
      <div className="flex -space-x-1.5 group relative">
        {readers.slice(0, 3).map((reader) => (
          <div key={reader.id} className="relative">
            {reader.avatarUrl ? (
              <img
                src={reader.avatarUrl}
                alt={reader.fullName}
                className="h-4 w-4 rounded-full border border-white object-cover"
              />
            ) : (
              <div
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full border border-white bg-slate-200 text-[7px] font-medium text-slate-600',
                )}
              >
                {getInitials(reader.fullName)}
              </div>
            )}
          </div>
        ))}
        {readers.length > 3 && (
          <div className="flex h-4 w-4 items-center justify-center rounded-full border border-white bg-slate-200 text-[7px] font-medium text-slate-600">
            +{readers.length - 3}
          </div>
        )}

        {/* Tooltip on hover */}
        <div className="absolute bottom-full right-0 mb-1 hidden group-hover:block z-10">
          <div className="rounded-md bg-slate-800 px-2 py-1 text-[10px] text-white whitespace-nowrap shadow-lg">
            Read by {readers.map((r) => r.fullName).join(', ')}
          </div>
        </div>
      </div>
    </div>
  );
}
