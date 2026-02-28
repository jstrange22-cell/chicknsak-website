import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlitchTextProps {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
}

export function GlitchText({ children, className, as: Tag = 'span' }: GlitchTextProps) {
  return (
    <Tag
      className={cn(
        'relative inline-block group',
        className
      )}
    >
      <span className="relative z-10">{children}</span>
      {/* Glitch layers - visible on hover */}
      <span
        className="absolute inset-0 text-brand-gold opacity-0 group-hover:opacity-70 pointer-events-none"
        style={{ animation: 'none' }}
        aria-hidden
      >
        <span
          className="block group-hover:animate-[glitch_0.3s_ease-in-out]"
          style={{ clipPath: 'inset(0)' }}
        >
          {children}
        </span>
      </span>
      <span
        className="absolute inset-0 text-brand-red opacity-0 group-hover:opacity-70 pointer-events-none"
        aria-hidden
      >
        <span
          className="block group-hover:animate-[glitch_0.3s_ease-in-out_0.05s]"
          style={{ clipPath: 'inset(0)' }}
        >
          {children}
        </span>
      </span>
    </Tag>
  );
}
