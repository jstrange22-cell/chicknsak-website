import type { Timestamp } from 'firebase/firestore';

// ============================================================
// Menu
// ============================================================

export type MenuCategory = 'wings' | 'sandwiches' | 'sides' | 'drinks' | 'specials';

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategory;
  imageUrl: string;
  isSignature: boolean;
  spiceLevel?: 0 | 1 | 2 | 3;
  available: boolean;
  sortOrder: number;
}

// ============================================================
// Products (K-Town Krack Shop)
// ============================================================

export type ProductCategory = 'spice' | 'sauce' | 'merch' | 'bundle';

export interface Product {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  images: string[];
  category: ProductCategory;
  inStock: boolean;
  stripePriceId?: string;
  featured: boolean;
  sortOrder: number;
}

export interface CartItem {
  productId: string;
  name: string;
  priceCents: number;
  quantity: number;
  imageUrl: string;
}

// ============================================================
// Events
// ============================================================

export type EventVibe = 'game-night' | 'dj-set' | 'live-music' | 'special' | 'private';

export interface SiteEvent {
  id: string;
  title: string;
  description: string;
  date: Timestamp;
  endDate?: Timestamp;
  imageUrl: string;
  vibe: EventVibe;
  ticketUrl?: string;
  location: string;
  isArchived: boolean;
  createdAt: Timestamp;
}

// ============================================================
// Leads (Contact Form)
// ============================================================

export type InquiryType = 'event_booking' | 'retail' | 'general' | 'partnership';

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  inquiryType: InquiryType;
  message: string;
  createdAt: Timestamp;
  status: 'new' | 'contacted' | 'resolved';
}

// ============================================================
// Orders
// ============================================================

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered';

export interface OrderLineItem {
  productId: string;
  name: string;
  quantity: number;
  priceCents: number;
}

export interface Order {
  id: string;
  customerEmail: string;
  items: OrderLineItem[];
  totalCents: number;
  status: OrderStatus;
  stripeSessionId?: string;
  createdAt: Timestamp;
}
