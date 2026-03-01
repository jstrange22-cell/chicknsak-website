import { Link } from 'react-router-dom';
import { BRAND, RESTAURANT_INFO, NAV_LINKS, SOCIAL_LINKS } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="bg-brand-dark border-t border-brand-gray-light/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <Link to="/" className="inline-block">
              <img
                src="/img/logo-dark.png"
                alt="Chick N Sak"
                className="h-16 w-auto"
              />
            </Link>
            <p className="mt-4 text-sm text-brand-muted leading-relaxed">
              {BRAND.tagline} &middot; Est. {BRAND.established}
            </p>
            <p className="mt-2 text-sm text-brand-muted">
              {BRAND.slogan}
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-brand-gold mb-4">
              Navigate
            </h3>
            <ul className="space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-brand-muted hover:text-brand-gold transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-brand-gold mb-4">
              Hours
            </h3>
            <ul className="space-y-3">
              {RESTAURANT_INFO.hours.map((h) => (
                <li key={h.days}>
                  <span className="block text-sm font-medium text-white">{h.days}</span>
                  <span className="text-sm text-brand-muted">{h.hours}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-heading text-lg font-bold uppercase tracking-wider text-brand-gold mb-4">
              Contact
            </h3>
            <div className="space-y-3 text-sm text-brand-muted">
              <p>{RESTAURANT_INFO.address.street}</p>
              <p>
                {RESTAURANT_INFO.address.city}, {RESTAURANT_INFO.address.state}{' '}
                {RESTAURANT_INFO.address.zip}
              </p>
              <p>
                <a
                  href={`tel:${RESTAURANT_INFO.phone}`}
                  className="hover:text-brand-gold transition-colors"
                >
                  {RESTAURANT_INFO.phone}
                </a>
              </p>
              <p>
                <a
                  href={`mailto:${RESTAURANT_INFO.email}`}
                  className="hover:text-brand-gold transition-colors"
                >
                  {RESTAURANT_INFO.email}
                </a>
              </p>
            </div>

            {/* Social */}
            <div className="flex gap-4 mt-6">
              {Object.entries(SOCIAL_LINKS).map(([name, href]) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs uppercase tracking-widest text-brand-muted hover:text-brand-gold transition-colors"
                >
                  {name}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-brand-gray-light/20 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-brand-muted">
            &copy; {new Date().getFullYear()} {BRAND.fullName}. All rights reserved.
          </p>
          <p className="text-xs text-brand-muted">
            Est. {BRAND.established} &middot; {BRAND.tagline}
          </p>
        </div>
      </div>
    </footer>
  );
}
