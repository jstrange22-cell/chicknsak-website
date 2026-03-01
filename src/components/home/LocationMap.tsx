import { MapPin, Phone, Clock } from 'lucide-react';
import { ScrollReveal } from '@/components/effects/ScrollReveal';
import { RESTAURANT_INFO } from '@/lib/constants';

const MAP_QUERY = encodeURIComponent(
  `${RESTAURANT_INFO.address.street}, ${RESTAURANT_INFO.address.city}, ${RESTAURANT_INFO.address.state} ${RESTAURANT_INFO.address.zip}`
);

export function LocationMap() {
  return (
    <section className="py-20 px-4 bg-brand-black">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12">
            <span className="font-script text-3xl text-brand-gold">
              Visit Us
            </span>
            <h2 className="font-heading text-4xl sm:text-5xl font-bold uppercase tracking-wider mt-2">
              Find Us
            </h2>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
            {/* Address */}
            <div className="flex items-start gap-4">
              <MapPin className="h-6 w-6 text-brand-gold shrink-0 mt-1" />
              <div>
                <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-brand-gold mb-1">
                  Location
                </h3>
                <p className="text-brand-muted">
                  {RESTAURANT_INFO.address.street}
                </p>
                <p className="text-brand-muted">
                  {RESTAURANT_INFO.address.city},{' '}
                  {RESTAURANT_INFO.address.state}{' '}
                  {RESTAURANT_INFO.address.zip}
                </p>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-start gap-4">
              <Phone className="h-6 w-6 text-brand-gold shrink-0 mt-1" />
              <div>
                <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-brand-gold mb-1">
                  Call Us
                </h3>
                <a
                  href={`tel:${RESTAURANT_INFO.phone}`}
                  className="text-brand-muted hover:text-brand-gold transition-colors"
                >
                  {RESTAURANT_INFO.phone}
                </a>
              </div>
            </div>

            {/* Hours */}
            <div className="flex items-start gap-4">
              <Clock className="h-6 w-6 text-brand-gold shrink-0 mt-1" />
              <div>
                <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-brand-gold mb-1">
                  Hours
                </h3>
                {RESTAURANT_INFO.hours.map((h) => (
                  <p key={h.days} className="text-brand-muted text-sm">
                    <span className="text-white">{h.days}:</span> {h.hours}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="rounded-xl overflow-hidden border border-brand-gray-light/30 h-[400px] sm:h-[500px]">
            <iframe
              title="Chick N Sak Location"
              width="100%"
              height="100%"
              style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${MAP_QUERY}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
            />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
