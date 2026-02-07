import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Building2, Users, Tag, Bookmark, Link2, ChevronRight, ArrowLeft } from 'lucide-react';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/components/settings/UserProfile';
import { CompanySettings } from '@/components/settings/CompanySettings';
import { TeamManagement } from '@/components/settings/TeamManagement';
import { TagManagement } from '@/components/settings/TagManagement';
import { LabelManagement } from '@/components/settings/LabelManagement';
import { IntegrationSettings } from '@/components/integrations/IntegrationSettings';

type SettingsSection = 'menu' | 'profile' | 'company' | 'team' | 'tags' | 'labels' | 'integrations';

const VALID_SECTIONS: SettingsSection[] = ['profile', 'company', 'team', 'tags', 'labels', 'integrations'];

const menuItems: { id: SettingsSection; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'company', label: 'Company', icon: Building2, adminOnly: true },
  { id: 'team', label: 'Team', icon: Users, adminOnly: true },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'labels', label: 'Labels', icon: Bookmark },
  { id: 'integrations', label: 'Integrations', icon: Link2, adminOnly: true },
];

export default function Settings() {
  const { profile } = useAuthContext();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial tab from URL search params (e.g. /settings?tab=company)
  const tabParam = searchParams.get('tab') as SettingsSection | null;
  const initialSection: SettingsSection =
    tabParam && VALID_SECTIONS.includes(tabParam) ? tabParam : (isDesktop ? 'profile' : 'menu');

  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);

  // Sync from URL changes (e.g. navigating from sidebar user menu)
  useEffect(() => {
    const tab = searchParams.get('tab') as SettingsSection | null;
    if (tab && VALID_SECTIONS.includes(tab)) {
      setActiveSection(tab);
    }
  }, [searchParams]);

  const isAdmin = profile?.role === 'admin';
  const visibleItems = menuItems.filter((item) => !item.adminOnly || isAdmin);

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return <UserProfile />;
      case 'company':
        return <CompanySettings />;
      case 'team':
        return <TeamManagement />;
      case 'tags':
        return <TagManagement />;
      case 'labels':
        return <LabelManagement />;
      case 'integrations':
        return <IntegrationSettings />;
      default:
        return null;
    }
  };

  // Desktop: sidebar + content layout
  if (isDesktop) {
    return (
      <div className="flex gap-6 min-h-[calc(100vh-120px)]">
        <div className="w-56 flex-shrink-0">
          <nav className="space-y-1">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  activeSection === item.id
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex-1 max-w-2xl">{renderContent()}</div>
      </div>
    );
  }

  // Mobile: page push navigation
  if (activeSection !== 'menu') {
    const currentItem = menuItems.find((i) => i.id === activeSection);
    return (
      <div>
        <button
          onClick={() => setActiveSection('menu')}
          className="flex items-center gap-1 text-blue-500 mb-4 -mt-1 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Settings
        </button>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{currentItem?.label}</h2>
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {visibleItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveSection(item.id)}
          className="w-full flex items-center gap-3 p-4 bg-white rounded-xl hover:bg-slate-50 border border-slate-100"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <item.icon className="w-5 h-5 text-slate-500" />
          </div>
          <span className="flex-1 text-left text-sm font-medium text-slate-900">{item.label}</span>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </button>
      ))}
    </div>
  );
}
