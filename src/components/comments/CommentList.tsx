import { useState } from 'react';
import type { Comment } from '@/types';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { MoreVertical, Edit2, Trash2, User as UserIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDeleteComment, useUpdateComment } from '@/hooks/useComments';
import { Textarea } from '@/components/ui/Textarea';

interface CommentWithUser extends Comment {
  user?: {
    id: string;
    fullName: string;
    avatarUrl?: string;
  };
  coordinates?: {
    x: number;
    y: number;
  };
}

interface CommentListProps {
  comments: CommentWithUser[];
  isLoading?: boolean;
  photoId: string;
}

export function CommentList({ comments, isLoading, photoId }: CommentListProps) {
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-24" />
              <div className="h-4 bg-gray-200 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No comments yet</p>
        <p className="text-xs mt-1">Be the first to add a comment</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          photoId={photoId}
          isOwnComment={user?.uid === comment.userId}
        />
      ))}
    </div>
  );
}

interface CommentItemProps {
  comment: CommentWithUser;
  photoId: string;
  isOwnComment: boolean;
}

function CommentItem({ comment, photoId, isOwnComment }: CommentItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.body);

  const deleteComment = useDeleteComment();
  const updateComment = useUpdateComment();

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      await deleteComment.mutateAsync({ commentId: comment.id, photoId });
    }
    setShowMenu(false);
  };

  const handleUpdate = async () => {
    if (!editContent.trim()) return;
    await updateComment.mutateAsync({
      commentId: comment.id,
      content: editContent.trim(),
    });
    setIsEditing(false);
  };

  const createdDate = comment.createdAt
    ? comment.createdAt instanceof Date
      ? comment.createdAt
      : comment.createdAt.toDate()
    : null;

  return (
    <div className="flex gap-3 group">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {comment.user?.avatarUrl ? (
          <img
            src={comment.user.avatarUrl}
            alt={comment.user.fullName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-gray-500" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="font-medium text-sm">
              {comment.user?.fullName || 'Unknown User'}
            </span>
            {createdDate && (
              <span className="text-xs text-gray-500 ml-2">
                {formatDistanceToNow(createdDate, { addSuffix: true })}
              </span>
            )}
          </div>

          {isOwnComment && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity',
                  showMenu && 'opacity-100'
                )}
                onClick={() => setShowMenu(!showMenu)}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg py-1 z-20">
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                      onClick={() => {
                        setIsEditing(true);
                        setShowMenu(false);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
                      onClick={handleDelete}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="mt-2 space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px]"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleUpdate}
                disabled={updateComment.isPending}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditContent(comment.body);
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
            {comment.body}
          </p>
        )}

        {/* Pin indicator for coordinate-based comments */}
        {comment.coordinates && (
          <div className="mt-1 text-xs text-gray-400">
            📍 Pinned to photo
          </div>
        )}
      </div>
    </div>
  );
}
