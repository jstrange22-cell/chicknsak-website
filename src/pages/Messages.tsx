import { useState, lazy, Suspense } from 'react';
import { MessageCircle, Users, UsersRound, Loader2 } from 'lucide-react';
import { ChannelList } from '@/components/messaging/ChannelList';
import { ChannelView } from '@/components/messaging/ChannelView';
import { CreateChannelModal } from '@/components/messaging/CreateChannelModal';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const UsersPage = lazy(() => import('@/pages/UsersPage'));
const UserGroupsPage = lazy(() => import('@/pages/UserGroupsPage'));

type MessagesTab = 'channels' | 'users' | 'user-groups';

export default function Messages() {
  const [activeTab, setActiveTab] = useState<MessagesTab>('channels');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
  };

  const handleBack = () => {
    setSelectedChannelId(null);
  };

  const handleChannelCreated = (channelId: string) => {
    setSelectedChannelId(channelId);
  };

  // ---------- Tab bar ----------
  const TabBar = () => (
    <div className="flex border-b border-slate-200 bg-white px-4 overflow-x-auto scrollbar-hide">
      <button
        onClick={() => { setActiveTab('channels'); setSelectedChannelId(null); }}
        className={cn(
          'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors shrink-0 min-h-[44px]',
          activeTab === 'channels'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-slate-500 hover:text-slate-700',
        )}
      >
        <MessageCircle className="h-4 w-4" />
        Channels
      </button>
      <button
        onClick={() => setActiveTab('users')}
        className={cn(
          'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors shrink-0 min-h-[44px]',
          activeTab === 'users'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-slate-500 hover:text-slate-700',
        )}
      >
        <Users className="h-4 w-4" />
        Users
      </button>
      <button
        onClick={() => setActiveTab('user-groups')}
        className={cn(
          'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors shrink-0 min-h-[44px]',
          activeTab === 'user-groups'
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-slate-500 hover:text-slate-700',
        )}
      >
        <UsersRound className="h-4 w-4" />
        Groups
      </button>
    </div>
  );

  const LoadingFallback = () => (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  );

  // ---------- Non-channel tabs ----------
  if (activeTab !== 'channels') {
    return (
      <div className="h-full flex flex-col">
        <TabBar />
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<LoadingFallback />}>
            {activeTab === 'users' ? <UsersPage /> : <UserGroupsPage />}
          </Suspense>
        </div>
      </div>
    );
  }

  // ---------- MOBILE LAYOUT (Channels tab) ----------
  if (!isDesktop) {
    return (
      <>
        <div className="h-full flex flex-col">
          <TabBar />
          <div className="flex-1 overflow-hidden">
            {selectedChannelId ? (
              <ChannelView
                channelId={selectedChannelId}
                onBack={handleBack}
              />
            ) : (
              <ChannelList
                onSelectChannel={handleSelectChannel}
                selectedChannelId={selectedChannelId ?? undefined}
                onNewChannel={() => setShowCreateModal(true)}
              />
            )}
          </div>
        </div>

        <CreateChannelModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleChannelCreated}
        />
      </>
    );
  }

  // ---------- DESKTOP LAYOUT (Channels tab) ----------
  return (
    <>
      <div className="flex flex-col h-full">
        <TabBar />
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-[300px] shrink-0 border-r border-slate-200 h-full">
            <ChannelList
              onSelectChannel={handleSelectChannel}
              selectedChannelId={selectedChannelId ?? undefined}
              onNewChannel={() => setShowCreateModal(true)}
            />
          </div>

          {/* Main area */}
          <div className="flex-1 h-full">
            {selectedChannelId ? (
              <ChannelView channelId={selectedChannelId} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                  <MessageCircle className="h-7 w-7 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700">
                  Select a conversation
                </h3>
                <p className="text-sm text-slate-400 mt-1 max-w-xs">
                  Choose a channel from the sidebar or create a new one to start
                  messaging your team.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateChannelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleChannelCreated}
      />
    </>
  );
}
