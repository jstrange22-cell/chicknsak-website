import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * A single item within a checklist section.
 */
export interface ChecklistItem {
  /** Display label for the item. */
  label: string;
  /** Input type that determines how the item is rendered in the UI. */
  type: 'checkbox' | 'photo_required' | 'yes_no' | 'text' | 'number';
  /** Whether the item must be completed before the checklist can be submitted. */
  required: boolean;
}

/**
 * AI-generated checklist with named sections and typed items.
 */
export interface GeneratedChecklist {
  /** Suggested name for the checklist. */
  name: string;
  /** Ordered sections, each containing a list of checklist items. */
  sections: Array<{
    /** Section heading (e.g. "Pre-Pour Inspection", "Safety Checks"). */
    name: string;
    /** Items within this section. */
    items: ChecklistItem[];
  }>;
}

/**
 * Generate a structured checklist from a specification document or code excerpt.
 *
 * The edge function reads the supplied document text, identifies actionable
 * items, and organises them into labelled sections with appropriate input
 * types.
 *
 * @param documentText - Plain text content of the source document.
 * @param documentType - Optional hint about the document kind
 *                       (e.g. "spec", "safety_plan", "scope_of_work").
 */
export async function generateChecklistFromDocument(
  documentText: string,
  documentType?: string
): Promise<GeneratedChecklist> {
  const aiGenerateChecklist = httpsCallable<Record<string, unknown>, GeneratedChecklist>(functions, 'aiGenerateChecklist');
  const result = await aiGenerateChecklist({ documentText, documentType });
  return result.data;
}
