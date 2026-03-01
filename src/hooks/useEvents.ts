import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SiteEvent } from '@/types';

// Sample events for development
const now = new Date();
const SAMPLE_EVENTS: SiteEvent[] = [
  {
    id: 'e1', title: 'Friday Night DJ Set', description: 'DJ Blaze spins the hottest tracks while you feast on wings and drinks specials all night.',
    date: Timestamp.fromDate(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)),
    imageUrl: 'https://images.unsplash.com/photo-1571266028243-d220c6a8b0e5?w=800&q=80', vibe: 'dj-set', location: "Boo Jack's Sports Lounge", isArchived: false,
    createdAt: Timestamp.now(),
  },
  {
    id: 'e2', title: 'Super Bowl Watch Party', description: 'The ultimate game day experience. Giant screens, wing specials, and VIP table reservations available.',
    date: Timestamp.fromDate(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)),
    imageUrl: 'https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=800&q=80', vibe: 'game-night', location: "Boo Jack's Sports Lounge", isArchived: false,
    createdAt: Timestamp.now(),
  },
  {
    id: 'e3', title: 'Live Music Saturday', description: 'Local artists take the stage for an unforgettable night of live music and soul food.',
    date: Timestamp.fromDate(new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000)),
    imageUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80', vibe: 'live-music', location: "Boo Jack's Sports Lounge", isArchived: false,
    createdAt: Timestamp.now(),
  },
  {
    id: 'e4', title: 'K-Town Krack Launch Party', description: 'The night we dropped the XXX blend. A legendary evening of heat and beats.',
    date: Timestamp.fromDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80', vibe: 'special', location: "Boo Jack's Sports Lounge", isArchived: true,
    createdAt: Timestamp.now(),
  },
];

export function useEvents() {
  const [events, setEvents] = useState<SiteEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      if (!db) {
        setEvents(SAMPLE_EVENTS);
        setLoading(false);
        return;
      }
      try {
        const ref = collection(db, 'events');
        const q = query(ref, orderBy('date', 'desc'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setEvents(SAMPLE_EVENTS);
        } else {
          const docs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as SiteEvent[];
          setEvents(docs);
        }
      } catch {
        setEvents(SAMPLE_EVENTS);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  const upcomingEvents = events.filter((e) => !e.isArchived);
  const pastEvents = events.filter((e) => e.isArchived);

  return { events, upcomingEvents, pastEvents, loading };
}
