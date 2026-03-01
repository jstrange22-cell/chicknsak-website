import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { NAV_LINKS } from '@/lib/constants';
import { useCart } from '@/hooks/useCart';
import { FullScreenNav } from './FullScreenNav';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const totalItems = useCart((s) => s.totalItems);
  const isHome = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <nav
        className={cn(
          'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
          scrolled || !isHome
            ? 'bg-brand-black/95 backdrop-blur-md border-b border-brand-gray-light/30'
            : 'bg-transparent'
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex flex-col items-start leading-none">
              <span className="font-script text-2xl text-brand-gold">Boo Jack's</span>
              <span className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-white">Chick-N-Sack</span>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    'font-heading text-sm font-semibold uppercase tracking-widest transition-colors duration-200',
                    location.pathname === link.href
                      ? 'text-brand-gold'
                      : 'text-white hover:text-brand-gold'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right side: Cart + Hamburger */}
            <div className="flex items-center gap-4">
              <Link
                to="/shop"
                className="relative text-white hover:text-brand-gold transition-colors"
              >
                <ShoppingBag className="h-6 w-6" />
                {totalItems > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white"
                  >
                    {totalItems}
                  </motion.span>
                )}
              </Link>

              <button
                onClick={() => setMenuOpen(true)}
                className="md:hidden text-white hover:text-brand-gold transition-colors p-1"
                aria-label="Open menu"
              >
                <Menu className="h-7 w-7" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && <FullScreenNav onClose={() => setMenuOpen(false)} />}
      </AnimatePresence>
    </>
  );
}
