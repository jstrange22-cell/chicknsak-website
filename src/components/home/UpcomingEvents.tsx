import { Link } from 'react-router-dom';
import { ArrowRight, Calendar } from 'lucide-react';
import { ScrollReveal } from '@/components/effects/ScrollReveal';
import { useEvents } from '@/hooks/useEvents';
import { EVENT_VIBES } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function UpcomingEvents() {
  const { upcomingEvents, loading } = useEvents();

  if (loading) return null;

  const displayEvents = upcomingEvents.slice(0, 3);

  return (
    <section className="py-20 px-4 bg-brand-dark">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12">
            <h2 className="font-heading text-4xl sm:text-5xl font-bold uppercase tracking-wider text-white">
              Upcoming <span className="text-brand-gold">Events</span>
            </h2>
            <p className="text-brand-muted mt-3 text-lg">
              The lounge is always live
            </p>
          </div>
        </ScrollReveal>

        {/* Scrolling Marquee */}
        {displayEvents.length > 0 && (
          <div className="overflow-hidden mb-12">
            <div
              className="flex whitespace-nowrap"
              style={{ animation: 'marquee 20s linear infinite' }}
            >
              {[...displayEvents, ...displayEvents].map((event, i) => {
                const vibeInfo = EVENT_VIBES[event.vibe];
                return (
                  <span
                    key={`${event.id}-${i}`}
                    className="inline-flex items-center gap-3 px-8 font-heading text-2xl uppercase tracking-wider text-brand-muted"
                  >
                    <span className={cn(
                      'w-2 h-2 rounded-full',
                      vibeInfo.color === 'brand-gold' ? 'bg-brand-gold' : 'bg-brand-red'
                    )} />
                    {event.title}
                    <span className="text-brand-gold/50">&middot;</span>
                    {vibeInfo.label}
                    <span className="text-brand-gold/50">&middot;</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Event Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayEvents.map((event, i) => {
            const vibeInfo = EVENT_VIBES[event.vibe];
            const eventDate = event.date.toDate();
            return (
              <ScrollReveal key={event.id} delay={i * 0.1}>
                <div className="bg-brand-gray rounded-xl border border-brand-gray-light overflow-hidden hover:border-brand-gold/50 transition-all duration-300 group">
                  {/* Image */}
                  <div className="aspect-video bg-brand-gray-light relative overflow-hidden">
                    {event.imageUrl ? (
                      <img
                        src={event.imageUrl}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Calendar className="h-12 w-12 text-brand-gold/20" />
                      </div>
                    )}
                    <span className={cn(
                      'absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
                      vibeInfo.color === 'brand-gold'
                        ? 'bg-brand-gold text-black'
                        : 'bg-brand-red text-white'
                    )}>
                      {vibeInfo.label}
                    </span>
                  </div>

                  <div className="p-5">
                    <p className="text-sm text-brand-gold font-medium">
                      {eventDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                    <h3 className="font-heading text-xl font-bold uppercase text-white mt-2 group-hover:text-brand-gold transition-colors">
                      {event.title}
                    </h3>
                    <p className="text-sm text-brand-muted mt-2 line-clamp-2">
                      {event.description}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal>
          <div className="text-center mt-12">
            <Link
              to="/events"
              className="inline-flex items-center gap-2 font-heading text-lg uppercase tracking-widest text-brand-gold hover:text-white transition-colors"
            >
              See All Events
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
