import { supabase } from '@/lib/supabase';

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
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  const { data, error } = await supabase.functions.invoke('ai-generate-checklist', {
    body: { documentText, documentType },
  });

  if (error) {
    throw new Error(error.message || 'Checklist generation failed');
  }

  return data as GeneratedChecklist;
}
