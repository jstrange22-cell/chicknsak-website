import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ListTodo,
  CheckSquare,
  Image,
  Loader2,
  CheckCircle2,
  Circle,
  ChevronRight,
} from 'lucide-react';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useMyTasks, useCompleteTask } from '@/hooks/useTasks';
import { useMyChecklists } from '@/hooks/useChecklists';
import { usePhotos } from '@/hooks/usePhotos';
import { cn } from '@/lib/utils';
import type { Task } from '@/types';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-blue-500',
  low: 'border-l-slate-300',
};

const tabs = [
  { id: 'tasks', label: 'My Tasks', icon: ListTodo },
  { id: 'checklists', label: 'My Checklists', icon: CheckSquare },
  { id: 'photos', label: 'My Photos', icon: Image },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function MyStuff() {
  const navigate = useNavigate();
  const { user, profile } = useAuthContext();
  const [activeTab, setActiveTab] = useState<TabId>('tasks');

  const { data: myTasks, isLoading: tasksLoading } = useMyTasks();
  const { data: myChecklists, isLoading: checklistsLoading } = useMyChecklists();
  const { data: myPhotos, isLoading: photosLoading } = usePhotos({
    companyId: profile?.companyId,
    limit: 50,
  });

  const completeTask = useCompleteTask();

  // Filter photos by current user
  const userPhotos = myPhotos?.filter((p) => p.uploadedBy === user?.uid) ?? [];

  const handleCompleteTask = (taskId: string) => {
    completeTask.mutate({ taskId });
  };

  // Group tasks by project
  const tasksByProject = (myTasks ?? []).reduce(
    (acc, task) => {
      const key = task.projectId;
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    },
    {} as Record<string, Task[]>
  );

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">My Stuff</h1>

      {/* Tab Toggle */}
      <div className="flex bg-slate-100 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            <tab.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* My Tasks */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {tasksLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (myTasks ?? []).length === 0 ? (
            <div className="text-center py-12">
              <ListTodo className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No pending tasks</p>
              <p className="text-sm text-slate-400 mt-1">
                Tasks assigned to you will appear here
              </p>
            </div>
          ) : (
            Object.entries(tasksByProject).map(([projectId, tasks]) => (
              <div key={projectId} className="space-y-2">
                <button
                  onClick={() => navigate(`/projects/${projectId}`)}
                  className="text-sm font-medium text-slate-500 hover:text-blue-500 flex items-center gap-1"
                >
                  Project
                  <ChevronRight className="h-3 w-3" />
                </button>
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      'bg-white rounded-xl border border-slate-200 border-l-4 p-4',
                      PRIORITY_COLORS[task.priority] || 'border-l-slate-300',
                      task.status === 'completed' && 'opacity-60'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        className="shrink-0"
                        disabled={task.status === 'completed'}
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                        ) : (
                          <Circle className="h-6 w-6 text-slate-300 hover:text-emerald-400" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'font-medium text-slate-900',
                            task.status === 'completed' && 'line-through'
                          )}
                        >
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium',
                              task.priority === 'urgent' && 'bg-red-100 text-red-700',
                              task.priority === 'high' && 'bg-orange-100 text-orange-700',
                              task.priority === 'medium' && 'bg-blue-100 text-blue-700',
                              task.priority === 'low' && 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {task.priority}
                          </span>
                          {task.dueDate && (
                            <span
                              className={cn(
                                'text-xs',
                                new Date(task.dueDate) < new Date() &&
                                  task.status !== 'completed'
                                  ? 'text-red-500'
                                  : 'text-slate-400'
                              )}
                            >
                              Due {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* My Checklists */}
      {activeTab === 'checklists' && (
        <div className="space-y-3">
          {checklistsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : (myChecklists ?? []).length === 0 ? (
            <div className="text-center py-12">
              <CheckSquare className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No checklists assigned</p>
              <p className="text-sm text-slate-400 mt-1">
                Checklists assigned to you will appear here
              </p>
            </div>
          ) : (
            (myChecklists ?? []).map((checklist) => {
              const percent =
                checklist.totalItems > 0
                  ? Math.round(
                      (checklist.completedItems / checklist.totalItems) * 100
                    )
                  : 0;

              return (
                <button
                  key={checklist.id}
                  onClick={() =>
                    navigate(`/projects/${checklist.projectId}`)
                  }
                  className="w-full bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-slate-900">
                      {checklist.name}
                    </h4>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        checklist.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-blue-100 text-blue-700'
                      )}
                    >
                      {checklist.status === 'completed'
                        ? 'Completed'
                        : 'In Progress'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-500 shrink-0">
                      {checklist.completedItems}/{checklist.totalItems}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* My Photos */}
      {activeTab === 'photos' && (
        <div>
          {photosLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : userPhotos.length === 0 ? (
            <div className="text-center py-12">
              <Image className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500">No photos yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Photos you upload will appear here
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {userPhotos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() =>
                    navigate(`/projects/${photo.projectId}`)
                  }
                  className="aspect-square rounded-lg overflow-hidden bg-slate-100"
                >
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt={photo.description || 'Photo'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
