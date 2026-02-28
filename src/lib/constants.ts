// ============================================================
// Chick N Sak Brand Constants
// ============================================================

export const BRAND = {
  name: 'Chick N Sak',
  fullName: "Boo Jack's Chick-N-Sack",
  tagline: 'Sports Lounge',
  established: 2015,
  slogan: 'Where Flavor Meets the Game',
} as const;

export const COLORS = {
  black: '#000000',
  dark: '#0a0a0a',
  gray: '#1a1a1a',
  grayLight: '#2a2a2a',
  gold: '#FFCC00',
  goldDark: '#D4A800',
  red: '#FF0000',
  redDark: '#CC0000',
  light: '#f5f5f5',
  muted: '#999999',
} as const;

export const NAV_LINKS = [
  { label: 'Menu', href: '/menu' },
  { label: 'Shop', href: '/shop' },
  { label: 'Events', href: '/events' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
] as const;

export const SOCIAL_LINKS = {
  instagram: '#',
  facebook: '#',
  twitter: '#',
  tiktok: '#',
} as const;

export const RESTAURANT_INFO = {
  phone: '(555) 555-5555',
  email: 'info@chicknsak.com',
  address: {
    street: '123 Main Street',
    city: 'K-Town',
    state: 'GA',
    zip: '30301',
  },
  hours: [
    { days: 'Monday - Thursday', hours: '11:00 AM - 10:00 PM' },
    { days: 'Friday - Saturday', hours: '11:00 AM - 2:00 AM' },
    { days: 'Sunday', hours: '12:00 PM - 9:00 PM' },
  ],
} as const;

export const MENU_CATEGORIES = [
  { value: 'wings' as const, label: 'Wings' },
  { value: 'sandwiches' as const, label: 'Sandwiches' },
  { value: 'sides' as const, label: 'Sides' },
  { value: 'drinks' as const, label: 'Drinks' },
  { value: 'specials' as const, label: 'Specials' },
] as const;

export const PRODUCT_CATEGORIES = [
  { value: 'spice' as const, label: 'Seasonings' },
  { value: 'sauce' as const, label: 'Sauces' },
  { value: 'merch' as const, label: 'Merch' },
  { value: 'bundle' as const, label: 'Bundles' },
] as const;

export const EVENT_VIBES = {
  'game-night': { label: 'Game Night', color: 'brand-gold' },
  'dj-set': { label: 'DJ Set', color: 'brand-red' },
  'live-music': { label: 'Live Music', color: 'brand-gold' },
  'special': { label: 'Special Event', color: 'brand-red' },
  'private': { label: 'Private Event', color: 'brand-gray-light' },
} as const;

export const INQUIRY_TYPES = [
  { value: 'event_booking' as const, label: 'Event Booking' },
  { value: 'retail' as const, label: 'Spice / Retail Inquiry' },
  { value: 'general' as const, label: 'General Inquiry' },
  { value: 'partnership' as const, label: 'Partnership / Wholesale' },
] as const;
