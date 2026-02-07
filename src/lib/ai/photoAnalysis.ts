import { supabase } from '@/lib/supabase';

/**
 * Structured result returned by the AI photo analysis edge function.
 */
export interface PhotoAnalysis {
  /** Human-readable caption describing the photo content. */
  caption: string;
  /** Detected construction phase (e.g. "framing", "foundation", "finishing"). */
  phase: string;
  /** Notable observations about safety, progress, or quality. */
  observations: string[];
}

/**
 * Send a photo URL to the Supabase edge function for AI-powered analysis.
 *
 * The edge function inspects the image and returns a structured caption,
 * detected construction phase, and a list of observations relevant to
 * jobsite documentation.
 *
 * @param photoUrl   - Public URL of the photo to analyze.
 * @param projectContext - Optional free-text context (project name, trade, etc.)
 *                         that helps the model produce more accurate results.
 */
export async function analyzePhoto(
  photoUrl: string,
  projectContext?: string
): Promise<PhotoAnalysis> {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  const { data, error } = await supabase.functions.invoke('ai-analyze-photo', {
    body: { photoUrl, projectContext },
  });

  if (error) {
    throw new Error(error.message || 'Photo analysis failed');
  }

  return data as PhotoAnalysis;
}
