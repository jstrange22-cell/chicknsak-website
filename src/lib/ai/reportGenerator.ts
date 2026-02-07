import { supabase } from '@/lib/supabase';

/**
 * Metadata for a single photo that will be included in the generated report.
 */
export interface ReportPhoto {
  /** Public URL of the photo. */
  url: string;
  /** Optional caption already associated with the photo. */
  caption?: string;
  /** Optional tags / labels applied to the photo. */
  tags?: string[];
  /** ISO-8601 timestamp of when the photo was taken. */
  timestamp?: string;
}

/**
 * AI-generated report structure returned by the edge function.
 */
export interface GeneratedReport {
  /** Ordered sections that make up the report body. */
  sections: Array<{
    /** Section heading (e.g. "Framing Progress", "Safety Concerns"). */
    title: string;
    /** Indices into the original `photos` array that belong to this section. */
    photoIndices: number[];
    /** AI-written narrative notes for the section. */
    notes: string;
  }>;
  /** Executive summary of the entire report. */
  summary: string;
  /** Actionable recommendations derived from the photos. */
  recommendations: string[];
}

/**
 * Generate a structured report from a collection of jobsite photos.
 *
 * The edge function groups photos into logical sections, writes narrative
 * notes for each section, and produces a summary with recommendations.
 *
 * @param photos      - Array of photo metadata to include in the report.
 * @param projectName - Name of the project (used in headings / context).
 * @param reportType  - The kind of report to generate (e.g. "daily", "progress", "safety").
 */
export async function generateReportFromPhotos(
  photos: ReportPhoto[],
  projectName: string,
  reportType: string
): Promise<GeneratedReport> {
  if (!supabase) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  const { data, error } = await supabase.functions.invoke('ai-generate-report', {
    body: { photos, projectName, reportType },
  });

  if (error) {
    throw new Error(error.message || 'Report generation failed');
  }

  return data as GeneratedReport;
}
