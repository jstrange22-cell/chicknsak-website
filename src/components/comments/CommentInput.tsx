import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Send, AtSign, X } from 'lucide-react';
import { useCreateComment } from '@/hooks/useComments';
import { useAuth } from '@/hooks/useAuth';

interface CommentInputProps {
  photoId: string;
  projectId: string;
  companyId: string;
  placeholder?: string;
  coordinates?: { x: number; y: number };
  onSubmit?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

interface UserMention {
  id: string;
  name: string;
}

export function CommentInput({
  photoId,
  projectId,
  companyId,
  placeholder = 'Add a comment...',
  coordinates,
  onSubmit,
  onCancel,
  autoFocus = false,
}: CommentInputProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedMentions, setSelectedMentions] = useState<UserMention[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const createComment = useCreateComment();

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Mock users for mentions - in real app, this would come from company members
  const availableUsers: UserMention[] = [
    { id: '1', name: 'John Smith' },
    { id: '2', name: 'Jane Doe' },
    { id: '3', name: 'Bob Johnson' },
  ];

  const filteredUsers = availableUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(mentionQuery.toLowerCase()) &&
      !selectedMentions.find((m) => m.id === u.id)
  );

  const handleContentChange = (value: string) => {
    setContent(value);

    // Check for @ mentions
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = value.substring(lastAtIndex + 1);
      const hasSpace = textAfterAt.includes(' ');
      if (!hasSpace) {
        setMentionQuery(textAfterAt);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const handleMentionSelect = (mention: UserMention) => {
    const lastAtIndex = content.lastIndexOf('@');
    const newContent =
      content.substring(0, lastAtIndex) + `@${mention.name} `;
    setContent(newContent);
    setSelectedMentions([...selectedMentions, mention]);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!content.trim() || !user) return;

    await createComment.mutateAsync({
      photoId,
      projectId,
      companyId,
      userId: user.uid,
      content: content.trim(),
      mentions: selectedMentions.map((m) => m.id),
      coordinates,
    });

    setContent('');
    setSelectedMentions([]);
    onSubmit?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onCancel?.();
    }
  };

  return (
    <div className="relative">
      {/* Coordinate indicator */}
      {coordinates && (
        <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
            📍 Pinned comment at ({Math.round(coordinates.x)}%, {Math.round(coordinates.y)}%)
          </span>
          {onCancel && (
            <button
              className="text-gray-400 hover:text-gray-600"
              onClick={onCancel}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[40px] max-h-[120px] resize-none pr-10"
            rows={1}
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => {
              setContent(content + '@');
              setShowMentions(true);
              textareaRef.current?.focus();
            }}
          >
            <AtSign className="w-4 h-4" />
          </button>
        </div>
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!content.trim() || createComment.isPending}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Mentions dropdown */}
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-white rounded-lg shadow-lg border py-1 z-10">
          {filteredUsers.map((mention) => (
            <button
              key={mention.id}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              onClick={() => handleMentionSelect(mention)}
            >
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                {mention.name.charAt(0)}
              </div>
              {mention.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
