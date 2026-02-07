import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

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
 * Send a photo URL to the Firebase Cloud Function for AI-powered analysis.
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
  const aiAnalyzePhoto = httpsCallable<Record<string, unknown>, PhotoAnalysis>(functions, 'aiAnalyzePhoto');
  const result = await aiAnalyzePhoto({ photoUrl, projectContext });
  return result.data;
}
