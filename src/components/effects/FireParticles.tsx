import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  color: string;
}

interface FireParticlesProps {
  trigger: boolean;
  originX?: number;
  originY?: number;
  onComplete?: () => void;
}

const PARTICLE_COLORS = ['#FFCC00', '#FF6600', '#FF0000', '#FF3300', '#FFaa00'];

export function FireParticles({
  trigger,
  originX = 0,
  originY = 0,
  onComplete,
}: FireParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (trigger) {
      const newParticles: Particle[] = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        x: originX,
        y: originY,
        angle: (i / 12) * 360 + Math.random() * 30,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, 600);

      return () => clearTimeout(timer);
    }
  }, [trigger]);

  return (
    <AnimatePresence>
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const distance = 40 + Math.random() * 40;
        return (
          <motion.div
            key={p.id}
            className="pointer-events-none fixed z-50 rounded-full"
            style={{
              left: p.x,
              top: p.y,
              backgroundColor: p.color,
              width: 6 + Math.random() * 6,
              height: 6 + Math.random() * 6,
            }}
            initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              scale: 0,
              x: Math.cos(rad) * distance,
              y: Math.sin(rad) * distance,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        );
      })}
    </AnimatePresence>
  );
}
