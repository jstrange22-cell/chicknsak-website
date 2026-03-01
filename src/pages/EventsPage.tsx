import { Calendar } from 'lucide-react';
import { EventGrid } from '@/components/events/EventGrid';
import { EventCountdown } from '@/components/events/EventCountdown';
import { ScrollReveal } from '@/components/effects/ScrollReveal';
import { useEvents } from '@/hooks/useEvents';

export default function EventsPage() {
  const { upcomingEvents, pastEvents, loading } = useEvents();
  const nextEvent = upcomingEvents[0];

  return (
    <div className="pt-8 pb-20 px-4 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <ScrollReveal>
          <div className="text-center mb-12">
            <Calendar className="h-10 w-10 text-brand-gold mx-auto mb-4" />
            <h1 className="font-heading text-5xl sm:text-6xl font-bold uppercase tracking-wider text-white">
              Events
            </h1>
            <p className="text-brand-muted mt-3 text-lg max-w-2xl mx-auto">
              The lounge is always live. Game nights, DJ sets, live music,
              and special events every week.
            </p>
          </div>
        </ScrollReveal>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-gold border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-16">
            {/* Countdown to next event */}
            {nextEvent && (
              <ScrollReveal>
                <EventCountdown event={nextEvent} />
              </ScrollReveal>
            )}

            {/* Upcoming Events */}
            <EventGrid
              events={upcomingEvents}
              title="Upcoming"
              subtitle="Don't miss what's next"
            />

            {/* Past Vibes */}
            {pastEvents.length > 0 && (
              <div className="pt-8 border-t border-brand-gray-light/30">
                <EventGrid
                  events={pastEvents}
                  title="Past Vibes"
                  subtitle="You had to be there"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
