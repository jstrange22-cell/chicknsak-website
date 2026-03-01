import { Link } from 'react-router-dom';
import { ScrollReveal } from '@/components/effects/ScrollReveal';

export function SpiceTeaser() {
  return (
    <section className="py-20 px-4 bg-brand-black relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 30% 50%, rgba(255,0,0,0.2) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(255,204,0,0.15) 0%, transparent 60%)',
        }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Product visual */}
          <ScrollReveal direction="left">
            <div className="relative aspect-square max-w-md mx-auto">
              <img
                src={`${import.meta.env.BASE_URL}img/ktownkrack-product.jpg`}
                alt="K-Town Krack Hot Chicken Dust Seasoning"
                className="w-full h-full object-cover rounded-2xl"
              />
            </div>
          </ScrollReveal>

          {/* Right: Copy */}
          <ScrollReveal direction="right">
            <div className="text-center lg:text-left">
              <span className="font-heading text-sm uppercase tracking-[0.3em] text-brand-red">
                Now Available Online
              </span>
              <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold uppercase text-white mt-4">
                Dare You to Get{' '}
                <span className="text-brand-gold">Addicted</span>
              </h2>
              <p className="text-brand-muted text-lg mt-6 leading-relaxed">
                Take the heat home. Our legendary K-Town Krack spice blend is
                now available for your kitchen. From the original blend to the
                XXX — find your level of fire.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center lg:justify-start">
                <Link
                  to="/shop"
                  className="inline-flex items-center justify-center h-14 px-8 text-base font-semibold uppercase tracking-wider bg-brand-red text-white hover:bg-brand-red-dark rounded-lg transition-all duration-200"
                >
                  Shop Now
                </Link>
                <Link
                  to="/shop"
                  className="inline-flex items-center justify-center h-14 px-8 text-base font-semibold uppercase tracking-wider border-2 border-brand-gold text-brand-gold hover:bg-brand-gold hover:text-black rounded-lg transition-all duration-200"
                >
                  See All Products
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
