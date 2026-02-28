import { Flame } from 'lucide-react';
import { GlitchText } from '@/components/effects/GlitchText';
import { cn } from '@/lib/utils';
import type { MenuItem as MenuItemType } from '@/types';

interface MenuItemProps {
  item: MenuItemType;
}

export function MenuItem({ item }: MenuItemProps) {
  return (
    <div className="group bg-brand-gray rounded-xl border border-brand-gray-light hover:border-brand-gold/50 transition-all duration-300 overflow-hidden">
      {/* Image */}
      <div className="aspect-[4/3] bg-brand-gray-light relative overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Flame className="h-12 w-12 text-brand-gold/20" />
          </div>
        )}

        {/* Spice Level */}
        {item.spiceLevel != null && item.spiceLevel > 0 && (
          <div className="absolute top-3 right-3 flex gap-0.5">
            {Array.from({ length: item.spiceLevel }).map((_, i) => (
              <Flame
                key={i}
                className={cn(
                  'h-4 w-4',
                  item.spiceLevel === 3 ? 'text-brand-red' : 'text-brand-gold'
                )}
              />
            ))}
          </div>
        )}

        {/* Signature badge */}
        {item.isSignature && (
          <span className="absolute top-3 left-3 px-2 py-1 bg-brand-gold text-black text-[10px] font-bold uppercase tracking-wider rounded">
            Signature
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <GlitchText
            as="h3"
            className="font-heading text-lg font-bold uppercase text-white group-hover:text-brand-gold transition-colors"
          >
            {item.name}
          </GlitchText>
          <span className="font-heading text-xl font-bold text-brand-gold shrink-0">
            ${item.price.toFixed(2)}
          </span>
        </div>
        <p className="text-sm text-brand-muted mt-2 leading-relaxed">
          {item.description}
        </p>
      </div>
    </div>
  );
}
