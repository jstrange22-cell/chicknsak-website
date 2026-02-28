import { Calendar, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EVENT_VIBES } from '@/lib/constants';
import type { SiteEvent } from '@/types';

interface EventCardProps {
  event: SiteEvent;
}

export function EventCard({ event }: EventCardProps) {
  const vibeInfo = EVENT_VIBES[event.vibe];
  const eventDate = event.date.toDate();
  const isGold = vibeInfo.color === 'brand-gold';

  return (
    <div className="group bg-brand-gray rounded-xl border border-brand-gray-light hover:border-brand-gold/50 transition-all duration-300 overflow-hidden">
      {/* Image */}
      <div className="aspect-video bg-brand-gray-light relative overflow-hidden">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Calendar className="h-12 w-12 text-brand-gold/20" />
          </div>
        )}
        <span
          className={cn(
            'absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
            isGold ? 'bg-brand-gold text-black' : 'bg-brand-red text-white'
          )}
        >
          {vibeInfo.label}
        </span>

        {/* Date badge */}
        <div className="absolute bottom-3 right-3 bg-brand-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
          <span className="block font-heading text-2xl font-bold text-brand-gold">
            {eventDate.getDate()}
          </span>
          <span className="block text-[10px] uppercase tracking-wider text-white">
            {eventDate.toLocaleDateString('en-US', { month: 'short' })}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <p className="text-sm text-brand-gold font-medium flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {eventDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <h3 className="font-heading text-xl font-bold uppercase text-white mt-2 group-hover:text-brand-gold transition-colors">
          {event.title}
        </h3>
        <p className="text-sm text-brand-muted mt-2 line-clamp-2">
          {event.description}
        </p>
        <p className="text-xs text-brand-muted mt-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {event.location}
        </p>

        {event.ticketUrl && (
          <a
            href={event.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 px-4 py-2 bg-brand-gold text-black text-sm font-bold uppercase tracking-wider rounded hover:bg-brand-gold-dark transition-colors"
          >
            Get Tickets
          </a>
        )}
      </div>
    </div>
  );
}
