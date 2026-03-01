import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Phone, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NAV_LINKS, RESTAURANT_INFO } from '@/lib/constants';
import { useCart } from '@/hooks/useCart';
import { FullScreenNav } from './FullScreenNav';

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const totalItems = useCart((s) => s.totalItems);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <nav className="bg-brand-black/95 backdrop-blur-md border-b border-brand-gray-light/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <img
                src={`${import.meta.env.BASE_URL}img/logo.png`}
                alt="Boo Jack's Chick-N-Sack"
                className="h-14 w-auto"
              />
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`font-heading text-sm font-semibold uppercase tracking-widest transition-colors duration-200 ${
                    location.pathname === link.href
                      ? 'text-brand-gold'
                      : 'text-white hover:text-brand-gold'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Right side: Phone + Cart + Hamburger */}
            <div className="flex items-center gap-4">
              <a
                href={`tel:${RESTAURANT_INFO.phone.replace(/\D/g, '')}`}
                className="hidden sm:flex items-center gap-2 text-brand-muted hover:text-brand-gold transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span className="text-sm font-medium">{RESTAURANT_INFO.phone}</span>
              </a>

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
