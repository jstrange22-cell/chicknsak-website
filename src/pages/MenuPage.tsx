import { useState } from 'react';
import { MenuItem } from '@/components/menu/MenuItem';
import { MenuCategoryFilter } from '@/components/menu/MenuCategory';
import { ScrollReveal } from '@/components/effects/ScrollReveal';
import { useMenu } from '@/hooks/useMenu';
import type { MenuCategory } from '@/types';

export default function MenuPage() {
  const [category, setCategory] = useState<MenuCategory | 'all'>('all');
  const { items, loading } = useMenu(category === 'all' ? undefined : category);

  return (
    <div className="pt-8 pb-20 px-4 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <ScrollReveal>
          <div className="text-center mb-12">
            <span className="font-script text-3xl text-brand-gold">Boo Jack's</span>
            <h1 className="font-heading text-5xl sm:text-6xl font-bold uppercase tracking-wider text-white mt-2">
              Our Menu
            </h1>
            <p className="text-brand-muted mt-3 text-lg max-w-2xl mx-auto">
              From our legendary K-Town Krack Wings to the signature Boo Jack Burger —
              every dish is crafted to hit different.
            </p>
          </div>
        </ScrollReveal>

        {/* Category Filter */}
        <ScrollReveal>
          <div className="flex justify-center mb-10">
            <MenuCategoryFilter selected={category} onSelect={setCategory} />
          </div>
        </ScrollReveal>

        {/* Menu Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item, i) => (
              <ScrollReveal key={item.id} delay={i * 0.05}>
                <MenuItem item={item} />
              </ScrollReveal>
            ))}
          </div>
        )}

        {items.length === 0 && !loading && (
          <p className="text-center text-brand-muted text-lg py-20">
            No items in this category yet. Check back soon!
          </p>
        )}
      </div>
    </div>
  );
}
