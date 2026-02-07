import { useNavigate } from 'react-router-dom';
import {
  MessageCircle,
  AtSign,
  Camera,
  ClipboardList,
  FolderOpen,
  Bell,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useNotifications, useMarkRead, useMarkAllRead } from '@/hooks/useNotifications';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { NotificationType } from '@/types';

const typeIcons: Record<NotificationType, React.ElementType> = {
  mention: AtSign,
  comment: MessageCircle,
  photo_upload: Camera,
  task_assigned: ClipboardList,
  task_completed: ClipboardList,
  checklist_assigned: ClipboardList,
  checklist_completed: ClipboardList,
  project_update: FolderOpen,
  system: Bell,
};

const typeColors: Record<NotificationType, string> = {
  mention: 'bg-blue-100 text-blue-600',
  comment: 'bg-green-100 text-green-600',
  photo_upload: 'bg-purple-100 text-purple-600',
  task_assigned: 'bg-amber-100 text-amber-600',
  task_completed: 'bg-emerald-100 text-emerald-600',
  checklist_assigned: 'bg-orange-100 text-orange-600',
  checklist_completed: 'bg-emerald-100 text-emerald-600',
  project_update: 'bg-cyan-100 text-cyan-600',
  system: 'bg-gray-100 text-gray-600',
};

export default function Notifications() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications(user?.uid);
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const handleNotificationClick = async (notification: { id: string; actionUrl?: string; isRead: boolean }) => {
    if (!notification.isRead) {
      await markRead.mutateAsync(notification.id);
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleMarkAllRead = () => {
    if (user?.uid) {
      markAllRead.mutate(user.uid);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{unreadCount} unread</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markAllRead.isPending}
            className="text-blue-500"
          >
            <CheckCheck className="w-4 h-4 mr-1" />
            Mark all read
          </Button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-12 w-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No notifications yet</p>
          <p className="text-sm text-slate-400 mt-1">
            You'll be notified about comments, mentions, and updates
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notification) => {
            const Icon = typeIcons[notification.type] || Bell;
            const colorClass = typeColors[notification.type] || typeColors.system;
            const createdAt = notification.createdAt?.toDate?.() || new Date();

            return (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors",
                  notification.isRead
                    ? "bg-white hover:bg-slate-50"
                    : "bg-blue-50/50 hover:bg-blue-50"
                )}
              >
                <div className={cn("flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center", colorClass)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", !notification.isRead && "font-semibold")}>
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{notification.body}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {formatRelativeTime(createdAt)}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="flex-shrink-0 mt-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
