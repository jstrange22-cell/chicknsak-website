import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { NAV_LINKS, SOCIAL_LINKS } from '@/lib/constants';

interface FullScreenNavProps {
  onClose: () => void;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const menuVariants = {
  hidden: { x: '100%' },
  visible: {
    x: 0,
    transition: { type: 'spring' as const, damping: 25, stiffness: 200 },
  },
  exit: {
    x: '100%',
    transition: { duration: 0.3 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.1 + i * 0.08,
      type: 'spring' as const,
      damping: 20,
      stiffness: 150,
    },
  }),
};

export function FullScreenNav({ onClose }: FullScreenNavProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Menu Panel */}
      <motion.div
        className="absolute right-0 top-0 bottom-0 w-full sm:w-[400px] bg-brand-black flex flex-col"
        variants={menuVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Close Button */}
        <div className="flex justify-between items-center p-6">
          <Link to="/" onClick={onClose} className="flex flex-col items-start leading-none">
            <span className="font-script text-2xl text-brand-gold">Boo Jack's</span>
            <span className="font-heading text-xs font-bold uppercase tracking-[0.2em] text-white">Chick-N-Sack</span>
          </Link>
          <button
            onClick={onClose}
            className="text-white hover:text-brand-gold transition-colors p-2"
            aria-label="Close menu"
          >
            <X className="h-8 w-8" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex flex-col items-center justify-center flex-1 gap-8">
          {NAV_LINKS.map((link, i) => (
            <motion.div
              key={link.href}
              custom={i}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
            >
              <Link
                to={link.href}
                onClick={onClose}
                className="font-heading text-4xl sm:text-5xl font-bold uppercase tracking-widest text-white hover:text-brand-gold transition-colors duration-200 relative group"
              >
                {link.label}
                <span className="absolute -bottom-2 left-0 w-0 h-0.5 bg-brand-gold transition-all duration-300 group-hover:w-full" />
              </Link>
            </motion.div>
          ))}
        </nav>

        {/* Social Links */}
        <motion.div
          className="flex justify-center gap-6 pb-8 text-brand-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.5 } }}
        >
          {Object.entries(SOCIAL_LINKS).map(([name, href]) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm uppercase tracking-widest hover:text-brand-gold transition-colors"
            >
              {name}
            </a>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
