const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; [key: string]: unknown }>;
}

export async function callClaude(params: {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  model?: string;
}): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model || 'claude-sonnet-4-20250514',
      max_tokens: params.maxTokens || 1024,
      system: params.system,
      messages: params.messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

/** Helper to extract JSON from Claude's response (handles markdown code blocks) */
export function extractJSON<T>(text: string): T {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code block
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) {
      return JSON.parse(match[1].trim());
    }
    throw new Error('Could not extract JSON from response');
  }
}

/** Standard CORS headers for edge functions */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
