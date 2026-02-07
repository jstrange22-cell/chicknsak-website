import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { callClaude, extractJSON, corsHeaders } from '../_shared/claude.ts';

const SYSTEM_PROMPT = `You are a construction site photo analyst for a deck building and general contracting company. Analyze the photo and provide: 1. A concise caption (1-2 sentences) describing what's shown 2. Construction phase detected (foundation, framing, decking, railing, finishing, landscaping, other) 3. Any notable observations (safety concerns, progress status, quality notes). Return ONLY valid JSON: { "caption": string, "phase": string, "observations": string[] }`;

/** Infer the media type from a URL's extension or Content-Type header. */
function inferMediaType(
  url: string,
  contentType?: string | null,
): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  // Prefer the Content-Type header when available
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes('png')) return 'image/png';
    if (ct.includes('gif')) return 'image/gif';
    if (ct.includes('webp')) return 'image/webp';
    if (ct.includes('jpeg') || ct.includes('jpg')) return 'image/jpeg';
  }

  // Fall back to URL extension
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';

  // Default to JPEG (most common for photos)
  return 'image/jpeg';
}

/** Convert a Uint8Array to a base64 string (Deno-compatible). */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { photoUrl, projectContext } = body as {
      photoUrl: string;
      projectContext?: string;
    };

    if (!photoUrl) {
      return new Response(
        JSON.stringify({ error: 'photoUrl is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Download the photo
    const photoResponse = await fetch(photoUrl);
    if (!photoResponse.ok) {
      throw new Error(
        `Failed to download photo (${photoResponse.status}): ${photoResponse.statusText}`,
      );
    }

    const photoBytes = new Uint8Array(await photoResponse.arrayBuffer());
    const mediaType = inferMediaType(
      photoUrl,
      photoResponse.headers.get('content-type'),
    );
    const base64Data = uint8ArrayToBase64(photoBytes);

    // Build user message with optional project context
    const userTextParts: string[] = [];
    if (projectContext) {
      userTextParts.push(`Project context: ${projectContext}`);
    }
    userTextParts.push('Analyze this construction site photo.');

    const rawResponse = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: userTextParts.join('\n'),
            },
          ],
        },
      ],
      maxTokens: 1024,
    });

    const result = extractJSON<{
      caption: string;
      phase: string;
      observations: string[];
    }>(rawResponse);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('ai-analyze-photo error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
