import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { ChannelList } from '@/components/messaging/ChannelList';
import { ChannelView } from '@/components/messaging/ChannelView';
import { CreateChannelModal } from '@/components/messaging/CreateChannelModal';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function Messages() {
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

  // ---------- MOBILE LAYOUT ----------
  if (!isDesktop) {
    return (
      <>
        <div className="h-full">
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

        <CreateChannelModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleChannelCreated}
        />
      </>
    );
  }

  // ---------- DESKTOP LAYOUT ----------
  return (
    <>
      <div className="flex h-full">
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

      <CreateChannelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleChannelCreated}
      />
    </>
  );
}
