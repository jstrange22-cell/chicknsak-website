import { cn } from '@/lib/utils';
import { MENU_CATEGORIES } from '@/lib/constants';
import type { MenuCategory as MenuCategoryType } from '@/types';

interface MenuCategoryProps {
  selected: MenuCategoryType | 'all';
  onSelect: (category: MenuCategoryType | 'all') => void;
}

export function MenuCategoryFilter({ selected, onSelect }: MenuCategoryProps) {
  const tabs = [
    { value: 'all' as const, label: 'All' },
    ...MENU_CATEGORIES,
  ];

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onSelect(tab.value)}
          className={cn(
            'shrink-0 px-5 py-2.5 rounded-full font-heading text-sm font-semibold uppercase tracking-wider transition-all duration-200',
            selected === tab.value
              ? 'bg-brand-gold text-black'
              : 'bg-brand-gray border border-brand-gray-light text-brand-muted hover:text-white hover:border-brand-gold/50'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
