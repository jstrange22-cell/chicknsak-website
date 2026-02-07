import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useReactions } from '@/hooks/useMessages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageReactionsProps {
  messageId: string;
  reactions?: Record<string, string[]>;
  isCurrentUser: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_EMOJIS = ['\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F525}'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageReactions({
  messageId,
  reactions,
  isCurrentUser,
}: MessageReactionsProps) {
  const { user } = useAuthContext();
  const { toggleReaction } = useReactions();
  const [showPicker, setShowPicker] = useState(false);

  const hasReactions = reactions && Object.keys(reactions).length > 0;

  const handleToggle = async (emoji: string) => {
    await toggleReaction(messageId, emoji, reactions);
    setShowPicker(false);
  };

  return (
    <div className="relative">
      {/* Reaction counts display */}
      {hasReactions && (
        <div
          className={cn(
            'flex flex-wrap gap-1 mt-1',
            isCurrentUser ? 'justify-end' : 'justify-start',
          )}
        >
          {Object.entries(reactions).map(([emoji, users]) => {
            if (!users || users.length === 0) return null;
            const isReactedByMe = user?.uid ? users.includes(user.uid) : false;

            return (
              <button
                key={emoji}
                onClick={() => void handleToggle(emoji)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
                  isReactedByMe
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                <span>{emoji}</span>
                <span className="font-medium">{users.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Add reaction button */}
      <div
        className={cn(
          'flex mt-0.5',
          isCurrentUser ? 'justify-end' : 'justify-start',
        )}
      >
        <button
          onClick={() => setShowPicker((prev) => !prev)}
          className="text-slate-300 hover:text-slate-500 text-xs px-1 py-0.5 rounded transition-colors"
          aria-label="Add reaction"
        >
          +
        </button>
      </div>

      {/* Quick emoji picker */}
      {showPicker && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowPicker(false)}
          />
          {/* Picker */}
          <div
            className={cn(
              'absolute z-20 flex gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg',
              isCurrentUser ? 'right-0' : 'left-0',
              'bottom-full mb-1',
            )}
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => void handleToggle(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-slate-100 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
