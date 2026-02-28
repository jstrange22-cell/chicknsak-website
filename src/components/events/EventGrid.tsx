import { EventCard } from './EventCard';
import { ScrollReveal } from '@/components/effects/ScrollReveal';
import type { SiteEvent } from '@/types';

interface EventGridProps {
  events: SiteEvent[];
  title: string;
  subtitle?: string;
}

export function EventGrid({ events, title, subtitle }: EventGridProps) {
  if (events.length === 0) return null;

  return (
    <div>
      <ScrollReveal>
        <h2 className="font-heading text-3xl sm:text-4xl font-bold uppercase tracking-wider text-white mb-2">
          {title}
        </h2>
        {subtitle && (
          <p className="text-brand-muted text-lg mb-8">{subtitle}</p>
        )}
      </ScrollReveal>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event, i) => (
          <ScrollReveal key={event.id} delay={i * 0.1}>
            <EventCard event={event} />
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
