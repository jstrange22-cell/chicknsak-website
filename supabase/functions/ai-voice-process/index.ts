import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { callClaude, extractJSON, corsHeaders } from '../_shared/claude.ts';

type TargetType =
  | 'checklist'
  | 'daily_log'
  | 'walkthrough_note'
  | 'progress_recap'
  | 'page'
  | 'description';

const SYSTEM_PROMPTS: Record<TargetType, string> = {
  checklist:
    'Convert this spoken description of work scope into a structured checklist. Return ONLY valid JSON: { "name": string, "sections": [{ "name": string, "items": [{ "label": string, "type": "checkbox"|"photo_required"|"yes_no", "required": boolean }] }] }',

  daily_log:
    'Convert this spoken end-of-day summary into a structured daily log. Return ONLY valid JSON: { "title": string, "date": string, "sections": [{ "heading": string, "content": string }], "weather": string|null, "hoursWorked": number|null, "crewMembers": string[]|null }',

  walkthrough_note:
    'Convert this spoken walkthrough narration into organized notes. Return ONLY valid JSON: { "title": string, "sections": [{ "area": string, "observations": string, "photos_needed": string[], "action_items": string[] }] }',

  progress_recap:
    'Summarize this spoken progress update. Return ONLY valid JSON: { "title": string, "summary": string, "completedItems": string[], "inProgressItems": string[], "blockers": string[], "nextSteps": string[] }',

  description:
    'Clean up this spoken photo description into a concise, professional caption. Return ONLY valid JSON: { "description": string }',

  page:
    'Organize this spoken content into a structured document. Return ONLY valid JSON: { "title": string, "content": string }',
};

const VALID_TARGET_TYPES = new Set<string>(Object.keys(SYSTEM_PROMPTS));

interface VoiceProcessRequest {
  transcript: string;
  targetType: string;
  projectContext?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as VoiceProcessRequest;
    const { transcript, targetType, projectContext } = body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'transcript is required and must be a non-empty string' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Default to 'page' if targetType is missing or unrecognized
    const resolvedType: TargetType = VALID_TARGET_TYPES.has(targetType)
      ? (targetType as TargetType)
      : 'page';

    const systemPrompt = SYSTEM_PROMPTS[resolvedType];

    // Build user message with optional project context
    const messageParts: string[] = [];
    if (projectContext) {
      messageParts.push(`Project context: ${projectContext}`);
    }
    messageParts.push(`Transcript:\n${transcript.trim()}`);

    const rawResponse = await callClaude({
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: messageParts.join('\n\n'),
        },
      ],
      maxTokens: 2048,
    });

    const result = extractJSON<Record<string, unknown>>(rawResponse);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('ai-voice-process error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
