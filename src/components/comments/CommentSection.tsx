import { CommentList } from './CommentList';
import { CommentInput } from './CommentInput';
import { useComments } from '@/hooks/useComments';
import { MessageCircle } from 'lucide-react';

interface CommentSectionProps {
  photoId: string;
  projectId: string;
  companyId: string;
}

export function CommentSection({ photoId, projectId, companyId }: CommentSectionProps) {
  const { data: comments, isLoading } = useComments(photoId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b">
        <MessageCircle className="w-5 h-5 text-gray-500" />
        <h3 className="font-medium">
          Comments {comments && comments.length > 0 && `(${comments.length})`}
        </h3>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto py-4">
        <CommentList
          comments={comments || []}
          isLoading={isLoading}
          photoId={photoId}
        />
      </div>

      {/* Input */}
      <div className="pt-3 border-t">
        <CommentInput
          photoId={photoId}
          projectId={projectId}
          companyId={companyId}
        />
      </div>
    </div>
  );
}
