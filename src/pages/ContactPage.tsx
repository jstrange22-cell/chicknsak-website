import { Mail, Phone, MapPin, Clock } from 'lucide-react';
import { ContactForm } from '@/components/contact/ContactForm';
import { ScrollReveal } from '@/components/effects/ScrollReveal';
import { RESTAURANT_INFO } from '@/lib/constants';

export default function ContactPage() {
  return (
    <div className="pt-32 pb-20 px-4 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <ScrollReveal>
          <div className="text-center mb-12">
            <h1 className="font-heading text-5xl sm:text-6xl font-bold uppercase tracking-wider text-white">
              Get In <span className="text-brand-gold">Touch</span>
            </h1>
            <p className="text-brand-muted mt-3 text-lg max-w-2xl mx-auto">
              Questions? Event inquiries? Want to bring K-Town Krack to your store?
              We'd love to hear from you.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
          {/* Contact Form */}
          <div className="lg:col-span-3">
            <ScrollReveal>
              <ContactForm />
            </ScrollReveal>
          </div>

          {/* Info Sidebar */}
          <div className="lg:col-span-2">
            <ScrollReveal direction="right">
              <div className="space-y-8">
                {/* Location */}
                <div className="bg-brand-gray rounded-xl border border-brand-gray-light p-6">
                  <h3 className="font-heading text-lg font-bold uppercase text-brand-gold flex items-center gap-2 mb-4">
                    <MapPin className="h-5 w-5" />
                    Location
                  </h3>
                  <p className="text-white">
                    {RESTAURANT_INFO.address.street}
                  </p>
                  <p className="text-brand-muted">
                    {RESTAURANT_INFO.address.city}, {RESTAURANT_INFO.address.state}{' '}
                    {RESTAURANT_INFO.address.zip}
                  </p>
                </div>

                {/* Phone & Email */}
                <div className="bg-brand-gray rounded-xl border border-brand-gray-light p-6">
                  <h3 className="font-heading text-lg font-bold uppercase text-brand-gold flex items-center gap-2 mb-4">
                    <Phone className="h-5 w-5" />
                    Contact
                  </h3>
                  <a
                    href={`tel:${RESTAURANT_INFO.phone}`}
                    className="block text-white hover:text-brand-gold transition-colors"
                  >
                    {RESTAURANT_INFO.phone}
                  </a>
                  <a
                    href={`mailto:${RESTAURANT_INFO.email}`}
                    className="block text-brand-muted hover:text-brand-gold transition-colors mt-1"
                  >
                    <Mail className="h-4 w-4 inline mr-1" />
                    {RESTAURANT_INFO.email}
                  </a>
                </div>

                {/* Hours */}
                <div className="bg-brand-gray rounded-xl border border-brand-gray-light p-6">
                  <h3 className="font-heading text-lg font-bold uppercase text-brand-gold flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5" />
                    Hours
                  </h3>
                  <ul className="space-y-3">
                    {RESTAURANT_INFO.hours.map((h) => (
                      <li key={h.days} className="flex justify-between">
                        <span className="text-white text-sm">{h.days}</span>
                        <span className="text-brand-muted text-sm">{h.hours}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </div>
  );
}
