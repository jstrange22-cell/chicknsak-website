import { useState } from 'react';
import { X, QrCode, Users, Link2, PlayCircle } from 'lucide-react';
import { ProjectList } from '@/components/projects/ProjectList';
import { ProjectMap } from '@/components/projects/ProjectMap';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'map';

// Onboarding cards shown at the top of the project list (CompanyCam style)
// First card (QR) is dark blue, rest are light blue/gray
const onboardingCards = [
  {
    id: 'qr',
    icon: QrCode,
    text: 'Scan this QR code to get the app and start taking photos.',
    color: 'bg-blue-600 text-white',
    iconBg: 'bg-white/10',
    dismissBg: 'bg-white/20 hover:bg-white/30',
  },
  {
    id: 'invite',
    icon: Users,
    text: 'Invite your team to keep every photo in one place.',
    color: 'bg-blue-50 text-slate-700',
    iconBg: 'bg-blue-100',
    dismissBg: 'bg-slate-200/60 hover:bg-slate-200',
  },
  {
    id: 'integration',
    icon: Link2,
    text: 'Connect an integration to simplify your workflow.',
    color: 'bg-blue-50 text-slate-700',
    iconBg: 'bg-blue-100',
    dismissBg: 'bg-slate-200/60 hover:bg-slate-200',
  },
  {
    id: 'demo',
    icon: PlayCircle,
    text: 'Watch a demo to get an overview of all the features.',
    color: 'bg-blue-50 text-slate-700',
    iconBg: 'bg-blue-100',
    dismissBg: 'bg-slate-200/60 hover:bg-slate-200',
  },
];

export default function Projects() {
  const [viewMode, _setViewMode] = useState<ViewMode>('list');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // Persist dismissed onboarding cards in localStorage
  const [dismissedCards, setDismissedCards] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('sw_dismissed_onboarding');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const visibleCards = onboardingCards.filter((c) => !dismissedCards.has(c.id));

  const dismissCard = (id: string) => {
    setDismissedCards((prev) => {
      const next = new Set(prev).add(id);
      localStorage.setItem('sw_dismissed_onboarding', JSON.stringify([...next]));
      return next;
    });
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-48px)] px-1 md:px-0">
      {/* Page Title - CompanyCam uses very prominent bold title */}
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4 md:mb-6">Projects</h1>

      {/* Onboarding Cards */}
      {visibleCards.length > 0 && (
        <div className="flex gap-3 mb-6 overflow-x-auto scrollbar-hide pb-1">
          {visibleCards.map((card) => (
            <div
              key={card.id}
              className={cn(
                'relative flex-shrink-0 w-[220px] rounded-xl p-4',
                card.color
              )}
            >
              <button
                onClick={() => dismissCard(card.id)}
                className={cn(
                  'absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center',
                  card.dismissBg
                )}
              >
                <X className="h-3 w-3" />
              </button>
              <div className="flex flex-col items-center text-center gap-3">
                <div
                  className={cn(
                    'flex h-16 w-16 items-center justify-center rounded-xl',
                    card.iconBg
                  )}
                >
                  <card.icon
                    className={cn(
                      'h-8 w-8',
                      card.id === 'qr' ? 'text-white' : 'text-blue-600'
                    )}
                  />
                </div>
                <p className="text-xs leading-relaxed">{card.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Content */}
      {viewMode === 'list' ? (
        <ProjectList onCreateClick={() => setIsCreateModalOpen(true)} />
      ) : (
        <ProjectMap onCreateClick={() => setIsCreateModalOpen(true)} />
      )}

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
