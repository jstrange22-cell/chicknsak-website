import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/hooks/useCart';
import { useCheckout } from '@/hooks/useCheckout';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, totalCents, totalItems, removeItem, updateQuantity, clearCart } = useCart();
  const { checkout, isLoading, error } = useCheckout();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-brand-dark border-l border-brand-gray-light flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-brand-gray-light">
              <h2 className="font-heading text-2xl font-bold uppercase text-white flex items-center gap-2">
                <ShoppingBag className="h-6 w-6 text-brand-gold" />
                Cart ({totalItems})
              </h2>
              <button
                onClick={onClose}
                className="text-brand-muted hover:text-white transition-colors p-1"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="h-16 w-16 text-brand-gray-light mx-auto mb-4" />
                  <p className="text-brand-muted text-lg">Your cart is empty</p>
                  <p className="text-brand-muted text-sm mt-1">
                    Add some K-Town Krack to get started!
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex gap-4 bg-brand-gray rounded-lg p-3 border border-brand-gray-light"
                  >
                    {/* Image */}
                    <div className="w-16 h-16 rounded bg-brand-gray-light shrink-0 overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="h-6 w-6 text-brand-gold/20" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-sm font-bold uppercase text-white truncate">
                        {item.name}
                      </h3>
                      <p className="text-brand-gold font-semibold text-sm mt-1">
                        ${(item.priceCents / 100).toFixed(2)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="p-1 rounded bg-brand-gray-light text-brand-muted hover:text-white transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-medium text-white w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="p-1 rounded bg-brand-gray-light text-brand-muted hover:text-white transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="ml-auto p-1 text-brand-muted hover:text-brand-red transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-6 border-t border-brand-gray-light space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-brand-muted text-sm uppercase tracking-wider">
                    Subtotal
                  </span>
                  <span className="font-heading text-2xl font-bold text-brand-gold">
                    ${(totalCents / 100).toFixed(2)}
                  </span>
                </div>

                {error && (
                  <p className="text-brand-red text-sm">{error}</p>
                )}

                <Button
                  variant="gold"
                  size="lg"
                  className="w-full"
                  onClick={() => checkout()}
                  isLoading={isLoading}
                >
                  Checkout
                </Button>

                <button
                  onClick={clearCart}
                  className="w-full text-center text-sm text-brand-muted hover:text-brand-red transition-colors"
                >
                  Clear Cart
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
