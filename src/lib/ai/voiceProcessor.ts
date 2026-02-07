import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * Supported target types that determine how the AI structures the
 * processed voice transcript.
 */
export type VoiceTargetType =
  | 'checklist'
  | 'daily_log'
  | 'walkthrough_note'
  | 'progress_recap'
  | 'page'
  | 'description';

/**
 * Process a raw voice transcript through the AI edge function.
 *
 * The `targetType` tells the model what structured output to produce.
 * For example, `"checklist"` yields checklist items while `"daily_log"`
 * produces a formatted daily log entry.
 *
 * The return type is generic so callers can narrow the shape based on
 * the `targetType` they provide:
 *
 * ```ts
 * const log = await processVoiceTranscript<DailyLogEntry>(
 *   transcript,
 *   'daily_log',
 *   'Building A – Floor 3'
 * );
 * ```
 *
 * @param transcript     - The raw speech-to-text transcript.
 * @param targetType     - Determines the structure of the AI output.
 * @param projectContext - Optional context to improve accuracy.
 */
export async function processVoiceTranscript<T = Record<string, unknown>>(
  transcript: string,
  targetType: VoiceTargetType,
  projectContext?: string
): Promise<T> {
  const aiVoiceProcess = httpsCallable<Record<string, unknown>, T>(functions, 'aiVoiceProcess');
  const result = await aiVoiceProcess({ transcript, targetType, projectContext });
  return result.data;
}
