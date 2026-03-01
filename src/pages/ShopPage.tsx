import { useState } from 'react';
import { Flame } from 'lucide-react';
import { ProductCard } from '@/components/shop/ProductCard';
import { CartDrawer } from '@/components/shop/CartDrawer';
import { SpiceDustCursor } from '@/components/shop/SpiceDustCursor';
import { ScrollReveal } from '@/components/effects/ScrollReveal';
import { useProducts } from '@/hooks/useProducts';
import { useCart } from '@/hooks/useCart';
import { PRODUCT_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { ProductCategory } from '@/types';

export default function ShopPage() {
  const [category, setCategory] = useState<ProductCategory | 'all'>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const { products, loading } = useProducts(category === 'all' ? undefined : category);
  const totalItems = useCart((s) => s.totalItems);

  // Open cart when items are added
  const prevTotalRef = { current: totalItems };
  if (totalItems > prevTotalRef.current) {
    // Don't open automatically - let users see the fire animation first
  }

  const tabs = [
    { value: 'all' as const, label: 'All Products' },
    ...PRODUCT_CATEGORIES,
  ];

  return (
    <div className="pt-8 pb-20 px-4 min-h-screen relative">
      <SpiceDustCursor />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <ScrollReveal>
          <div className="text-center mb-12">
            <Flame className="h-10 w-10 text-brand-red mx-auto mb-4" style={{ animation: 'fire-flicker 2s ease-in-out infinite' }} />
            <h1 className="font-heading text-5xl sm:text-6xl font-bold uppercase tracking-wider text-white">
              K-Town <span className="text-brand-red">Krack</span>
            </h1>
            <p className="text-brand-gold font-heading text-xl uppercase tracking-[0.3em] mt-2">
              Dare You to Get Addicted
            </p>
            <p className="text-brand-muted mt-3 text-lg max-w-2xl mx-auto">
              Take the legendary flavor home. Seasonings, sauces, and merch
              shipped straight to your door.
            </p>
          </div>
        </ScrollReveal>

        {/* Category Filter */}
        <ScrollReveal>
          <div className="flex justify-center mb-10">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setCategory(tab.value)}
                  className={cn(
                    'shrink-0 px-5 py-2.5 rounded-full font-heading text-sm font-semibold uppercase tracking-wider transition-all duration-200',
                    category === tab.value
                      ? 'bg-brand-red text-white'
                      : 'bg-brand-gray border border-brand-gray-light text-brand-muted hover:text-white hover:border-brand-red/50'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Cart Toggle */}
        {totalItems > 0 && (
          <div className="fixed bottom-6 right-6 z-40">
            <button
              onClick={() => setCartOpen(true)}
              className="bg-brand-gold text-black px-6 py-3 rounded-full font-heading font-bold uppercase tracking-wider shadow-lg hover:bg-brand-gold-dark transition-colors flex items-center gap-2"
            >
              View Cart ({totalItems})
            </button>
          </div>
        )}

        {/* Product Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-red border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product, i) => (
              <ScrollReveal key={product.id} delay={i * 0.05}>
                <ProductCard product={product} />
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>

      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
