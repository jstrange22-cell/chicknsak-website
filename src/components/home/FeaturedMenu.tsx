import { Link } from 'react-router-dom';
import { Flame, ArrowRight } from 'lucide-react';
import { ScrollReveal } from '@/components/effects/ScrollReveal';
import { useMenu } from '@/hooks/useMenu';
import { cn } from '@/lib/utils';

export function FeaturedMenu() {
  const { signatureItems, loading } = useMenu();

  if (loading) return null;

  return (
    <section className="py-20 px-4 bg-brand-dark">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12">
            <h2 className="font-heading text-4xl sm:text-5xl font-bold uppercase tracking-wider text-white">
              Signature <span className="text-brand-gold">Dishes</span>
            </h2>
            <p className="text-brand-muted mt-3 text-lg">
              The flavors that put us on the map
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {signatureItems.slice(0, 4).map((item, i) => (
            <ScrollReveal key={item.id} delay={i * 0.1}>
              <div className="group relative bg-brand-gray rounded-xl overflow-hidden border border-brand-gray-light hover:border-brand-gold/50 transition-all duration-300">
                {/* Image placeholder */}
                <div className="aspect-square bg-brand-gray-light relative overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Flame className="h-16 w-16 text-brand-gold/20" />
                    </div>
                  )}
                  {/* Spice level badge */}
                  {item.spiceLevel && item.spiceLevel > 0 && (
                    <div className="absolute top-3 right-3 flex gap-0.5">
                      {Array.from({ length: item.spiceLevel }).map((_, idx) => (
                        <Flame
                          key={idx}
                          className={cn(
                            'h-4 w-4',
                            item.spiceLevel === 3
                              ? 'text-brand-red'
                              : 'text-brand-gold'
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-heading text-lg font-bold uppercase text-white group-hover:text-brand-gold transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-sm text-brand-muted mt-1 line-clamp-2">
                    {item.description}
                  </p>
                  <p className="font-heading text-xl font-bold text-brand-gold mt-3">
                    ${item.price.toFixed(2)}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal>
          <div className="text-center mt-12">
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 font-heading text-lg uppercase tracking-widest text-brand-gold hover:text-white transition-colors"
            >
              View Full Menu
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
