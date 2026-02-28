import { useState, useRef } from 'react';
import { ShoppingBag, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { FireParticles } from '@/components/effects/FireParticles';
import { useCart } from '@/hooks/useCart';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [showFire, setShowFire] = useState(false);
  const [fireOrigin, setFireOrigin] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const addItem = useCart((s) => s.addItem);

  function handleAddToCart() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setFireOrigin({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
    setShowFire(true);
    addItem({
      productId: product.id,
      name: product.name,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
    });
  }

  return (
    <motion.div
      className="group bg-brand-gray rounded-xl border border-brand-gray-light hover:border-brand-gold/50 transition-all duration-300 overflow-hidden"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      {/* Image */}
      <div className="aspect-square bg-brand-gray-light relative overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Flame className="h-16 w-16 text-brand-red/20" />
          </div>
        )}

        {product.featured && (
          <span className="absolute top-3 left-3 px-2 py-1 bg-brand-red text-white text-[10px] font-bold uppercase tracking-wider rounded">
            Hot
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-heading text-lg font-bold uppercase text-white group-hover:text-brand-gold transition-colors">
          {product.name}
        </h3>
        <p className="text-sm text-brand-muted mt-1 line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center justify-between mt-4">
          <span className="font-heading text-2xl font-bold text-brand-gold">
            ${(product.priceCents / 100).toFixed(2)}
          </span>
          <Button
            ref={buttonRef}
            variant="fire"
            size="sm"
            onClick={handleAddToCart}
            className="gap-1.5"
          >
            <ShoppingBag className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      <FireParticles
        trigger={showFire}
        originX={fireOrigin.x}
        originY={fireOrigin.y}
        onComplete={() => setShowFire(false)}
      />
    </motion.div>
  );
}
