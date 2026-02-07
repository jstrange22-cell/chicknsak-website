import { useTypingUsers } from '@/hooks/useMessages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TypingIndicatorProps {
  channelId: string | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const typingUsers = useTypingUsers(channelId);

  if (typingUsers.length === 0) return null;

  const names =
    typingUsers.length === 1
      ? typingUsers[0].fullName
      : typingUsers.length === 2
        ? `${typingUsers[0].fullName} and ${typingUsers[1].fullName}`
        : `${typingUsers[0].fullName} and ${typingUsers.length - 1} others`;

  const verb = typingUsers.length === 1 ? 'is' : 'are';

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-slate-400">
      {/* Animated dots */}
      <span className="flex gap-0.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
      </span>
      <span>
        <span className="font-medium text-slate-500">{names}</span>{' '}
        {verb} typing...
      </span>
    </div>
  );
}
