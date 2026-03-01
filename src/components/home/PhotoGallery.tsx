import { ScrollReveal } from '@/components/effects/ScrollReveal';

const PHOTOS = [
  { src: 'image5.jpeg', alt: 'Glazed wings on a wooden plate' },
  { src: 'image6.jpeg', alt: 'Chicken tenders with K-Town Krack seasoning' },
  { src: 'wings-sauced.jpg', alt: 'Sauced wings with hot sauce' },
  { src: 'image7.jpeg', alt: 'Chicken tender dipped in sauce' },
  { src: 'image9.jpeg', alt: 'Waffles drizzled with honey' },
  { src: 'ktownkrack-flames.jpg', alt: 'K-Town Krack seasoning bottle in flames' },
];

export function PhotoGallery() {
  return (
    <section className="py-20 px-4 bg-brand-dark">
      <div className="max-w-7xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-12">
            <span className="font-script text-3xl text-brand-gold">From Our Kitchen</span>
            <h2 className="font-heading text-4xl sm:text-5xl font-bold uppercase text-white mt-2">
              The <span className="text-brand-gold">Flavor</span>
            </h2>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {PHOTOS.map((photo, i) => (
            <ScrollReveal key={photo.src} delay={i * 0.08}>
              <div className="overflow-hidden rounded-xl group">
                <img
                  src={`${import.meta.env.BASE_URL}img/${photo.src}`}
                  alt={photo.alt}
                  className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
