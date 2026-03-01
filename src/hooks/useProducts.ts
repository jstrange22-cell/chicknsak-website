import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, ProductCategory } from '@/types';

// Sample products for development
const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'p1', name: 'K-Town Krack Original', description: 'The legendary seasoning blend that started it all. Perfect on wings, fries, and everything.',
    priceCents: 1299, imageUrl: '', images: [], category: 'spice', inStock: true, featured: true, sortOrder: 1,
  },
  {
    id: 'p2', name: 'K-Town Krack Hot Sauce', description: 'Liquid fire in a bottle. Our signature hot sauce brings the heat to any dish.',
    priceCents: 999, imageUrl: '', images: [], category: 'sauce', inStock: true, featured: true, sortOrder: 2,
  },
  {
    id: 'p3', name: 'K-Town Krack XXX', description: 'For the fearless only. Triple the heat, triple the flavor. Dare you to get addicted.',
    priceCents: 1499, imageUrl: '', images: [], category: 'spice', inStock: true, featured: true, sortOrder: 3,
  },
  {
    id: 'p4', name: 'The Krack Pack Bundle', description: 'Get all three — Original, Hot Sauce, and XXX. Save $10 when you bundle up.',
    priceCents: 2999, imageUrl: '', images: [], category: 'bundle', inStock: true, featured: true, sortOrder: 4,
  },
  {
    id: 'p5', name: 'Chick N Sak Snapback', description: 'Black and gold snapback cap with embroidered Boo Jack\'s logo. One size fits all.',
    priceCents: 2499, imageUrl: '', images: [], category: 'merch', inStock: true, featured: false, sortOrder: 5,
  },
  {
    id: 'p6', name: 'K-Town Krack Tee', description: 'Premium cotton tee with the K-Town Krack explosion graphic. Available in S-3XL.',
    priceCents: 2999, imageUrl: '', images: [], category: 'merch', inStock: true, featured: false, sortOrder: 6,
  },
];

export function useProducts(category?: ProductCategory) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      if (!db) {
        const filtered = category
          ? SAMPLE_PRODUCTS.filter((p) => p.category === category)
          : SAMPLE_PRODUCTS;
        setProducts(filtered);
        setLoading(false);
        return;
      }
      try {
        const ref = collection(db, 'products');
        const constraints = [
          where('inStock', '==', true),
          orderBy('sortOrder'),
        ];
        if (category) {
          constraints.unshift(where('category', '==', category));
        }
        const q = query(ref, ...constraints);
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          const filtered = category
            ? SAMPLE_PRODUCTS.filter((p) => p.category === category)
            : SAMPLE_PRODUCTS;
          setProducts(filtered);
        } else {
          const docs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Product[];
          setProducts(docs);
        }
      } catch {
        const filtered = category
          ? SAMPLE_PRODUCTS.filter((p) => p.category === category)
          : SAMPLE_PRODUCTS;
        setProducts(filtered);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [category]);

  const featuredProducts = products.filter((p) => p.featured);

  return { products, featuredProducts, loading };
}
