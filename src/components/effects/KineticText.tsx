import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface KineticTextProps {
  text: string;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  delay?: number;
}

const container = {
  hidden: {},
  visible: (delay: number) => ({
    transition: {
      staggerChildren: 0.04,
      delayChildren: delay,
    },
  }),
};

const letter = {
  hidden: { opacity: 0, y: 50, rotateX: -90 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      type: 'spring' as const,
      damping: 12,
      stiffness: 100,
    },
  },
};

export function KineticText({
  text,
  className,
  as: Tag = 'h1',
  delay = 0,
}: KineticTextProps) {
  const words = text.split(' ');

  return (
    <Tag className={cn('overflow-hidden', className)}>
      <motion.span
        className="inline-flex flex-wrap"
        variants={container}
        custom={delay}
        initial="hidden"
        animate="visible"
      >
        {words.map((word, wordIndex) => (
          <span key={wordIndex} className="inline-flex mr-[0.25em]">
            {word.split('').map((char, charIndex) => (
              <motion.span
                key={`${wordIndex}-${charIndex}`}
                variants={letter}
                className="inline-block"
                style={{ transformOrigin: 'bottom' }}
              >
                {char}
              </motion.span>
            ))}
          </span>
        ))}
      </motion.span>
    </Tag>
  );
}
