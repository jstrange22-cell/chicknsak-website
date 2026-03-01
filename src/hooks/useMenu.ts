import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { MenuItem, MenuCategory } from '@/types';

// Sample data for development before Firestore is populated
const SAMPLE_MENU: MenuItem[] = [
  {
    id: '1', name: 'K-Town Krack Wings', description: 'Our signature wings tossed in the legendary K-Town Krack spice blend. Crispy, fiery, addictive.',
    price: 14.99, category: 'wings', imageUrl: '', isSignature: true, spiceLevel: 3, available: true, sortOrder: 1,
  },
  {
    id: '2', name: 'Honey Gold Wings', description: 'Sweet honey glaze meets golden perfection. A crowd favorite for game day.',
    price: 13.99, category: 'wings', imageUrl: '', isSignature: true, spiceLevel: 1, available: true, sortOrder: 2,
  },
  {
    id: '3', name: 'Lemon Pepper Wet', description: 'Atlanta-style lemon pepper wings, dripping with buttery citrus flavor.',
    price: 13.99, category: 'wings', imageUrl: '', isSignature: false, spiceLevel: 0, available: true, sortOrder: 3,
  },
  {
    id: '4', name: 'The Boo Jack Burger', description: 'Half-pound smash burger with smoked gouda, caramelized onions, and house sauce.',
    price: 16.99, category: 'sandwiches', imageUrl: '', isSignature: true, spiceLevel: 0, available: true, sortOrder: 1,
  },
  {
    id: '5', name: 'Crispy Chicken Sak', description: 'Buttermilk fried chicken breast on a toasted brioche bun with slaw and pickles.',
    price: 14.99, category: 'sandwiches', imageUrl: '', isSignature: true, spiceLevel: 1, available: true, sortOrder: 2,
  },
  {
    id: '6', name: 'Loaded Krack Fries', description: 'Crispy fries loaded with K-Town Krack seasoning, cheese sauce, and jalapeños.',
    price: 9.99, category: 'sides', imageUrl: '', isSignature: false, spiceLevel: 2, available: true, sortOrder: 1,
  },
  {
    id: '7', name: 'Mac & Cheese', description: 'Creamy four-cheese blend baked to perfection. Soul food at its finest.',
    price: 7.99, category: 'sides', imageUrl: '', isSignature: false, spiceLevel: 0, available: true, sortOrder: 2,
  },
  {
    id: '8', name: 'Game Day Punch', description: 'House-made tropical punch with a kick. Available by the glass or pitcher.',
    price: 6.99, category: 'drinks', imageUrl: '', isSignature: false, spiceLevel: 0, available: true, sortOrder: 1,
  },
];

export function useMenu(category?: MenuCategory) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMenu() {
      setLoading(true);
      if (!db) {
        const filtered = category
          ? SAMPLE_MENU.filter((i) => i.category === category)
          : SAMPLE_MENU;
        setItems(filtered);
        setLoading(false);
        return;
      }
      try {
        const menuRef = collection(db, 'menu_items');
        const constraints = [
          where('available', '==', true),
          orderBy('sortOrder'),
        ];
        if (category) {
          constraints.unshift(where('category', '==', category));
        }
        const q = query(menuRef, ...constraints);
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          // Use sample data if Firestore is empty
          const filtered = category
            ? SAMPLE_MENU.filter((i) => i.category === category)
            : SAMPLE_MENU;
          setItems(filtered);
        } else {
          const docs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as MenuItem[];
          setItems(docs);
        }
      } catch {
        // Fallback to sample data on error
        const filtered = category
          ? SAMPLE_MENU.filter((i) => i.category === category)
          : SAMPLE_MENU;
        setItems(filtered);
        setError(null);
      } finally {
        setLoading(false);
      }
    }

    fetchMenu();
  }, [category]);

  const signatureItems = items.filter((i) => i.isSignature);

  return { items, signatureItems, loading, error };
}
