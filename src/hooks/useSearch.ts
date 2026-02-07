import { useQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Project, Photo, Tag } from '@/types';
import { useState, useEffect } from 'react';

interface SearchResults {
  projects: Project[];
  photos: Photo[];
  tags: Tag[];
}

function matchesSearch(text: string | undefined | null, searchTerm: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(searchTerm.toLowerCase());
}

export function useSearch(searchQuery: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: async (): Promise<SearchResults> => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        return { projects: [], photos: [], tags: [] };
      }

      const term = debouncedQuery.toLowerCase();

      // Fetch and filter locally (Firestore doesn't support full-text search)
      const [projectsSnap, photosSnap, tagsSnap] = await Promise.all([
        getDocs(query(collection(db, 'projects'), orderBy('createdAt', 'desc'), limit(200))),
        getDocs(query(collection(db, 'photos'), orderBy('capturedAt', 'desc'), limit(200))),
        getDocs(query(collection(db, 'tags'), orderBy('name', 'asc'), limit(100))),
      ]);

      const projects = projectsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Project))
        .filter(
          (p) =>
            matchesSearch(p.name, term) ||
            matchesSearch(p.addressFull, term) ||
            matchesSearch(p.customerName, term) ||
            matchesSearch(p.description, term)
        )
        .slice(0, 10);

      const photos = photosSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Photo))
        .filter(
          (p) =>
            matchesSearch(p.description, term) ||
            matchesSearch(p.aiCaption, term)
        )
        .slice(0, 12);

      const tags = tagsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Tag))
        .filter((t) => matchesSearch(t.name, term))
        .slice(0, 8);

      return { projects, photos, tags };
    },
    enabled: debouncedQuery.length >= 2,
  });
}

// Recent searches stored in localStorage
const RECENT_SEARCHES_KEY = 'sw-recent-searches';
const MAX_RECENT = 8;

export function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string) {
  const recent = getRecentSearches().filter((s) => s !== term);
  recent.unshift(term);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCHES_KEY);
}
