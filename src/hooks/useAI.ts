import { useMutation } from '@tanstack/react-query';
import { analyzePhoto } from '@/lib/ai/photoAnalysis';
import { generateReportFromPhotos } from '@/lib/ai/reportGenerator';
import { processVoiceTranscript } from '@/lib/ai/voiceProcessor';
import { generateChecklistFromDocument } from '@/lib/ai/checklistGenerator';
import { translateText } from '@/lib/ai/translator';
import {
  sendJobMateMessage,
  type JobMateChatRequest,
  type JobMateChatResponse,
} from '@/lib/ai/jobmate';
import type { PhotoAnalysis } from '@/lib/ai/photoAnalysis';
import type { ReportPhoto, GeneratedReport } from '@/lib/ai/reportGenerator';
import type { VoiceTargetType } from '@/lib/ai/voiceProcessor';
import type { GeneratedChecklist } from '@/lib/ai/checklistGenerator';
import type { TranslationLanguage } from '@/lib/ai/translator';

// Re-export types so consumers can import everything from this hook file.
export type {
  PhotoAnalysis,
  ReportPhoto,
  GeneratedReport,
  VoiceTargetType,
  GeneratedChecklist,
  TranslationLanguage,
  JobMateChatRequest,
  JobMateChatResponse,
};

/**
 * Central hook that exposes every AI capability as a React Query mutation.
 *
 * Each property is a standard `useMutation` result, giving callers access
 * to `mutate` / `mutateAsync`, `isPending`, `isError`, `data`, `error`,
 * and `reset` out of the box.
 *
 * Usage:
 * ```tsx
 * const { analyzePhoto, jobmate } = useAI();
 *
 * // Fire-and-forget
 * analyzePhoto.mutate({ photoUrl: url });
 *
 * // Await the result
 * const result = await jobmate.mutateAsync({ message, mode, conversationHistory });
 * ```
 */
export function useAI() {
  const analyzePhotoMutation = useMutation<
    PhotoAnalysis,
    Error,
    { photoUrl: string; projectContext?: string }
  >({
    mutationFn: ({ photoUrl, projectContext }) =>
      analyzePhoto(photoUrl, projectContext),
  });

  const generateReportMutation = useMutation<
    GeneratedReport,
    Error,
    { photos: ReportPhoto[]; projectName: string; reportType: string }
  >({
    mutationFn: ({ photos, projectName, reportType }) =>
      generateReportFromPhotos(photos, projectName, reportType),
  });

  const processVoiceMutation = useMutation<
    Record<string, unknown>,
    Error,
    { transcript: string; targetType: VoiceTargetType; projectContext?: string }
  >({
    mutationFn: ({ transcript, targetType, projectContext }) =>
      processVoiceTranscript(transcript, targetType, projectContext),
  });

  const generateChecklistMutation = useMutation<
    GeneratedChecklist,
    Error,
    { documentText: string; documentType?: string }
  >({
    mutationFn: ({ documentText, documentType }) =>
      generateChecklistFromDocument(documentText, documentType),
  });

  const translateMutation = useMutation<
    string,
    Error,
    { text: string; targetLanguage: TranslationLanguage }
  >({
    mutationFn: ({ text, targetLanguage }) =>
      translateText(text, targetLanguage),
  });

  const jobmateMutation = useMutation<
    JobMateChatResponse,
    Error,
    JobMateChatRequest
  >({
    mutationFn: (request) => sendJobMateMessage(request),
  });

  return {
    analyzePhoto: analyzePhotoMutation,
    generateReport: generateReportMutation,
    processVoice: processVoiceMutation,
    generateChecklist: generateChecklistMutation,
    translate: translateMutation,
    jobmate: jobmateMutation,
  };
}
