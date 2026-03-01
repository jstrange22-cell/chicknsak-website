export function AnnouncementBanner() {
  const text =
    'Coming Soon Summer of 2026 \u00B7 Register today for news and Grand Opening date';

  return (
    <div className="bg-brand-gold overflow-hidden h-10 flex items-center">
      <div className="animate-marquee whitespace-nowrap flex gap-16">
        {/* Duplicate text for seamless loop */}
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="font-heading text-sm font-bold uppercase tracking-[0.15em] text-black px-8"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
