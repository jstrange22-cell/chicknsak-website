import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { callClaude, extractJSON, corsHeaders } from '../_shared/claude.ts';

const SYSTEM_PROMPT = `Analyze this construction document (scope of work, contract, specification, or plan) and extract a structured inspection/completion checklist. Return ONLY valid JSON: { "name": string, "sections": [{ "name": string, "items": [{ "label": string, "type": "checkbox"|"photo_required"|"yes_no"|"text"|"number", "required": boolean }] }] }`;

interface ChecklistRequest {
  documentText: string;
  documentType?: string;
}

interface ChecklistItem {
  label: string;
  type: 'checkbox' | 'photo_required' | 'yes_no' | 'text' | 'number';
  required: boolean;
}

interface ChecklistSection {
  name: string;
  items: ChecklistItem[];
}

interface ChecklistResult {
  name: string;
  sections: ChecklistSection[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ChecklistRequest;
    const { documentText, documentType } = body;

    if (
      !documentText ||
      typeof documentText !== 'string' ||
      documentText.trim().length === 0
    ) {
      return new Response(
        JSON.stringify({
          error: 'documentText is required and must be a non-empty string',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Build user message with optional document type hint
    const messageParts: string[] = [];
    if (documentType) {
      messageParts.push(`Document type: ${documentType}`);
    }
    messageParts.push(`Document content:\n${documentText.trim()}`);

    const rawResponse = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: messageParts.join('\n\n'),
        },
      ],
      maxTokens: 4096,
    });

    const result = extractJSON<ChecklistResult>(rawResponse);

    // Validate item types to ensure they match the expected enum
    const validTypes = new Set([
      'checkbox',
      'photo_required',
      'yes_no',
      'text',
      'number',
    ]);
    for (const section of result.sections) {
      for (const item of section.items) {
        if (!validTypes.has(item.type)) {
          item.type = 'checkbox'; // Default to checkbox for unrecognized types
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('ai-generate-checklist error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
