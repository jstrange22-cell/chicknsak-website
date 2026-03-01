import { Instagram, Facebook, Twitter, Music } from 'lucide-react';
import { ScrollReveal } from '@/components/effects/ScrollReveal';
import { SOCIAL_LINKS } from '@/lib/constants';

const SOCIALS = [
  { name: 'Instagram', href: SOCIAL_LINKS.instagram, icon: Instagram },
  { name: 'Facebook', href: SOCIAL_LINKS.facebook, icon: Facebook },
  { name: 'X / Twitter', href: SOCIAL_LINKS.twitter, icon: Twitter },
  { name: 'TikTok', href: SOCIAL_LINKS.tiktok, icon: Music },
];

export function SocialSection() {
  return (
    <section className="py-20 px-4 bg-brand-black border-t border-brand-gray-light/20">
      <ScrollReveal>
        <div className="max-w-2xl mx-auto text-center">
          <span className="font-script text-3xl text-brand-gold">Follow the Flavor</span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold uppercase text-white mt-2">
            Stay <span className="text-brand-gold">Connected</span>
          </h2>
          <p className="text-brand-muted mt-4">
            Follow us for the latest events, specials, and behind-the-scenes heat.
          </p>

          <div className="flex justify-center gap-8 mt-10">
            {SOCIALS.map(({ name, href, icon: Icon }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center gap-2"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-brand-gray-light text-brand-muted transition-all duration-300 group-hover:border-brand-gold group-hover:text-brand-gold group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="text-xs uppercase tracking-widest text-brand-muted group-hover:text-brand-gold transition-colors">
                  {name}
                </span>
              </a>
            ))}
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
