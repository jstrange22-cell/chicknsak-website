import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { callClaude, extractJSON, corsHeaders } from '../_shared/claude.ts';

const SYSTEM_PROMPT = `You are a professional construction report writer. Generate a structured photo report. Given these job site photos with captions, organize them into logical sections and write professional descriptions for each section. Return ONLY valid JSON: { "sections": [{ "title": string, "photoIndices": number[], "notes": string }], "summary": string, "recommendations": string[] }`;

interface PhotoEntry {
  url: string;
  caption?: string;
  tags?: string[];
  timestamp?: string;
}

interface ReportRequest {
  photos: PhotoEntry[];
  projectName: string;
  reportType: string;
}

interface ReportSection {
  title: string;
  photoIndices: number[];
  notes: string;
}

interface ReportResult {
  sections: ReportSection[];
  summary: string;
  recommendations: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as ReportRequest;
    const { photos, projectName, reportType } = body;

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'photos array is required and must not be empty' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!projectName) {
      return new Response(
        JSON.stringify({ error: 'projectName is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!reportType) {
      return new Response(
        JSON.stringify({ error: 'reportType is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Build a textual description of each photo for Claude to organize
    const photoDescriptions = photos.map((photo, index) => {
      const parts: string[] = [`Photo ${index + 1}:`];
      if (photo.caption) parts.push(`  Caption: ${photo.caption}`);
      if (photo.tags && photo.tags.length > 0)
        parts.push(`  Tags: ${photo.tags.join(', ')}`);
      if (photo.timestamp) parts.push(`  Taken: ${photo.timestamp}`);
      if (!photo.caption && !photo.tags?.length)
        parts.push('  (No caption or tags available)');
      return parts.join('\n');
    });

    const userMessage = [
      `Project: ${projectName}`,
      `Report Type: ${reportType}`,
      `Number of Photos: ${photos.length}`,
      '',
      'Photo Details:',
      ...photoDescriptions,
      '',
      `Please organize these ${photos.length} photos into a structured ${reportType} report.`,
      'Use 0-based indices when referencing photos in photoIndices arrays.',
    ].join('\n');

    const rawResponse = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      maxTokens: 2048,
    });

    const result = extractJSON<ReportResult>(rawResponse);

    // Validate that photoIndices reference valid photos
    for (const section of result.sections) {
      section.photoIndices = section.photoIndices.filter(
        (idx) => idx >= 0 && idx < photos.length,
      );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('ai-generate-report error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
