import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KineticText } from '@/components/effects/KineticText';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-brand-black">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black z-10" />
        {/* Animated background pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 50%, rgba(255,204,0,0.15) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(255,0,0,0.1) 0%, transparent 50%)',
            animation: 'slow-zoom 20s ease-in-out infinite alternate',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-20 text-center px-4 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="flex justify-center mb-4"
        >
          <img
            src={`${import.meta.env.BASE_URL}img/logo-full-dark.png`}
            alt="Boo Jack's Chick-N-Sack"
            className="h-40 sm:h-48 md:h-56 w-auto"
          />
        </motion.div>

        <KineticText
          text="CHICK-N-SACK"
          as="h1"
          className="font-heading text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-bold text-white tracking-wider"
          delay={0.3}
        />

        <motion.p
          className="font-heading text-lg sm:text-xl md:text-2xl text-brand-gold uppercase tracking-[0.3em] mt-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          Sports Lounge &middot; Est. 2015
        </motion.p>

        <motion.p
          className="text-brand-muted text-base sm:text-lg mt-6 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.6 }}
        >
          Where flavor meets the game. Signature wings, K-Town Krack spice,
          and the coldest drinks in the city.
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center mt-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.6 }}
        >
          <Link
            to="/menu"
            className="inline-flex items-center justify-center h-14 px-8 text-base font-semibold uppercase tracking-wider bg-brand-gold text-black hover:bg-brand-gold-dark rounded-lg transition-all duration-200"
          >
            View Menu
          </Link>
          <Link
            to="/shop"
            className="inline-flex items-center justify-center h-14 px-8 text-base font-semibold uppercase tracking-wider border-2 border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-black rounded-lg transition-all duration-200"
          >
            Shop K-Town Krack
          </Link>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
      >
        <div className="w-6 h-10 rounded-full border-2 border-brand-gold/40 flex items-start justify-center p-1.5">
          <motion.div
            className="w-1.5 h-3 rounded-full bg-brand-gold"
            animate={{ y: [0, 12, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          />
        </div>
      </motion.div>
    </section>
  );
}
