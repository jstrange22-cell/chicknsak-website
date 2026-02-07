// NOTE: Requires @supabase/supabase-js as a dependency.
// Install with: npm install @supabase/supabase-js
//
// Also add these environment variables to your .env file:
//   VITE_SUPABASE_URL=https://your-project.supabase.co
//   VITE_SUPABASE_ANON_KEY=your-anon-key

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn(
    '[Supabase] Missing environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
      'AI features that depend on Supabase Edge Functions will be unavailable.'
  );
}

export const supabase = supabaseInstance;
