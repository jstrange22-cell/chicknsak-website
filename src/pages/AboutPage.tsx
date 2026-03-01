import { Flame, MapPin, Award, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { ScrollReveal } from '@/components/effects/ScrollReveal';
import { BRAND, RESTAURANT_INFO } from '@/lib/constants';

const TIMELINE = [
  {
    year: '2012',
    title: 'The Food Truck Era',
    description:
      'It all started with a dream, a grill, and a truck. Boo Jack hit the streets serving up flavors that had lines wrapping around the block. Word spread fast — this wasn\'t just food, it was a movement.',
    icon: Flame,
  },
  {
    year: '2015',
    title: 'The Lounge Opens',
    description:
      'From mobile to permanent. Boo Jack\'s Chick-N-Sack Sports Lounge opens its doors, bringing the legendary flavors into a space where good food meets great vibes. Big screens, cold drinks, and the best wings in the city.',
    icon: MapPin,
  },
  {
    year: '2020',
    title: 'K-Town Krack is Born',
    description:
      'The people wanted to take the flavor home. K-Town Krack — our signature spice blend — launches as a retail product. "Dare you to get addicted" becomes more than a tagline.',
    icon: Award,
  },
  {
    year: 'Today',
    title: 'The Movement Continues',
    description:
      'From food truck to flagship. From local favorite to regional power. Chick N Sak continues to push the boundaries of what a sports lounge can be — one flavor bomb at a time.',
    icon: Users,
  },
];

export default function AboutPage() {
  return (
    <div className="pt-32 pb-20 px-4 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <ScrollReveal>
          <div className="text-center mb-16">
            <span className="font-script text-4xl text-brand-gold">Our Story</span>
            <h1 className="font-heading text-5xl sm:text-6xl font-bold uppercase tracking-wider text-white mt-2">
              Started From the
              <br />
              <span className="text-brand-gold">Bottom</span>
            </h1>
            <p className="text-brand-muted mt-4 text-lg max-w-2xl mx-auto leading-relaxed">
              From a food truck on the corner to the hottest sports lounge in town.
              This is the story of {BRAND.fullName}.
            </p>
          </div>
        </ScrollReveal>

        {/* Timeline */}
        <div className="relative">
          {/* Center line */}
          <div className="absolute left-6 sm:left-1/2 top-0 bottom-0 w-px bg-brand-gray-light sm:-translate-x-px" />

          <div className="space-y-12 sm:space-y-16">
            {TIMELINE.map((item, i) => {
              const Icon = item.icon;
              const isEven = i % 2 === 0;

              return (
                <ScrollReveal
                  key={item.year}
                  direction={isEven ? 'left' : 'right'}
                  delay={i * 0.1}
                >
                  <div className="relative flex items-start gap-8 sm:gap-0">
                    {/* Timeline dot */}
                    <motion.div
                      className="absolute left-6 sm:left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-brand-gray border-2 border-brand-gold flex items-center justify-center z-10"
                      whileInView={{ scale: [0.5, 1.1, 1] }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                    >
                      <Icon className="h-5 w-5 text-brand-gold" />
                    </motion.div>

                    {/* Content */}
                    <div
                      className={`ml-20 sm:ml-0 sm:w-[calc(50%-3rem)] ${
                        isEven ? 'sm:pr-0 sm:text-right' : 'sm:ml-auto sm:pl-0'
                      }`}
                    >
                      <span className="font-heading text-3xl sm:text-4xl font-bold text-brand-gold">
                        {item.year}
                      </span>
                      <h3 className="font-heading text-xl font-bold uppercase text-white mt-2">
                        {item.title}
                      </h3>
                      <p className="text-brand-muted mt-3 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>

        {/* Location CTA */}
        <ScrollReveal>
          <div className="mt-20 text-center bg-brand-gray rounded-2xl border border-brand-gray-light p-8 sm:p-12">
            <h2 className="font-heading text-3xl font-bold uppercase text-white">
              Come Visit the <span className="text-brand-gold">Lounge</span>
            </h2>
            <p className="text-brand-muted mt-3 text-lg">
              {RESTAURANT_INFO.address.street}, {RESTAURANT_INFO.address.city},{' '}
              {RESTAURANT_INFO.address.state} {RESTAURANT_INFO.address.zip}
            </p>
            <p className="text-brand-gold font-heading text-lg uppercase tracking-wider mt-2">
              {BRAND.tagline} &middot; Est. {BRAND.established}
            </p>
            <a
              href={`tel:${RESTAURANT_INFO.phone}`}
              className="inline-block mt-6 px-8 py-3 bg-brand-gold text-black font-bold uppercase tracking-wider rounded-lg hover:bg-brand-gold-dark transition-colors"
            >
              Call Us: {RESTAURANT_INFO.phone}
            </a>
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
