import { supabase } from '@/lib/supabase';

/**
 * Languages currently supported by the translation feature.
 * Extend this union as additional languages are enabled on the backend.
 */
export type TranslationLanguage = 'en' | 'es';

/**
 * Translate free-form text between supported languages.
 *
 * Under the hood this reuses the `ai-voice-process` edge function with a
 * special `targetType` of `'translation'` and a `projectContext` string
 * that communicates the desired target language. This avoids deploying a
 * separate edge function solely for translation.
 *
 * @param text           - The source text to translate.
 * @param targetLanguage - ISO 639-1 code of the desired output language.
 * @returns The translated string, falling back to the original text if the
 *          edge function does not return a translation field.
 */
export async function translateText(
  text: string,
  targetLanguage: TranslationLanguage
): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  const languageLabel = targetLanguage === 'es' ? 'Spanish' : 'English';

  const { data, error } = await supabase.functions.invoke('ai-voice-process', {
    body: {
      transcript: text,
      targetType: 'translation',
      projectContext: `Target language: ${languageLabel}`,
    },
  });

  if (error) {
    throw new Error(error.message || 'Translation failed');
  }

  // The edge function may return the translation under different keys
  // depending on the prompt template version. Prefer `translation`, fall
  // back to `description`, and ultimately return the original text.
  return (data as Record<string, string>).translation
    ?? (data as Record<string, string>).description
    ?? text;
}
