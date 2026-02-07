import { useState } from 'react';
import {
  Mic,
  BarChart3,
  Camera,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import VoiceCapture from '@/components/ai/VoiceCapture';
import { processVoiceTranscript, type VoiceTargetType } from '@/lib/ai/voiceProcessor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AIPageType = 'walkthrough_note' | 'daily_log' | 'progress_recap' | 'ai_summary';

interface AIPageActionsProps {
  pageType: AIPageType;
  projectId: string;
  onContentGenerated: (content: { title: string; body: string }) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAsPageContent(
  data: Record<string, unknown>,
  pageType: string
): string {
  if (pageType === 'walkthrough_note') {
    const d = data as {
      title?: string;
      sections?: Array<{
        area: string;
        observations: string;
        action_items?: string[];
      }>;
    };
    let content = '';
    d.sections?.forEach((s) => {
      content += `## ${s.area}\n\n${s.observations}\n\n`;
      if (s.action_items?.length) {
        content += `**Action Items:**\n${s.action_items.map((i) => `- ${i}`).join('\n')}\n\n`;
      }
    });
    return content;
  }

  if (pageType === 'daily_log') {
    const d = data as {
      title?: string;
      date?: string;
      summary?: string;
      work_completed?: string[];
      issues?: string[];
      notes?: string;
    };
    let content = '';
    if (d.date) content += `**Date:** ${d.date}\n\n`;
    if (d.summary) content += `${d.summary}\n\n`;
    if (d.work_completed?.length) {
      content += `## Work Completed\n\n${d.work_completed.map((w) => `- ${w}`).join('\n')}\n\n`;
    }
    if (d.issues?.length) {
      content += `## Issues\n\n${d.issues.map((i) => `- ${i}`).join('\n')}\n\n`;
    }
    if (d.notes) content += `## Notes\n\n${d.notes}\n\n`;
    return content;
  }

  if (pageType === 'progress_recap') {
    const d = data as {
      title?: string;
      period?: string;
      highlights?: string[];
      milestones?: string[];
      upcoming?: string[];
      summary?: string;
    };
    let content = '';
    if (d.period) content += `**Period:** ${d.period}\n\n`;
    if (d.summary) content += `${d.summary}\n\n`;
    if (d.highlights?.length) {
      content += `## Highlights\n\n${d.highlights.map((h) => `- ${h}`).join('\n')}\n\n`;
    }
    if (d.milestones?.length) {
      content += `## Milestones\n\n${d.milestones.map((m) => `- ${m}`).join('\n')}\n\n`;
    }
    if (d.upcoming?.length) {
      content += `## Upcoming\n\n${d.upcoming.map((u) => `- ${u}`).join('\n')}\n\n`;
    }
    return content;
  }

  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Action card configuration
// ---------------------------------------------------------------------------

interface ActionConfig {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  buttonLabel: string;
  usesVoice: boolean;
}

const ACTION_CONFIG: Record<AIPageType, ActionConfig> = {
  walkthrough_note: {
    icon: <Mic className="h-5 w-5" />,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    title: 'Dictate Walkthrough',
    description:
      'Record your walkthrough observations and the AI will structure them into organized notes with action items.',
    buttonLabel: 'Dictate Walkthrough',
    usesVoice: true,
  },
  daily_log: {
    icon: <Mic className="h-5 w-5" />,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    title: 'Dictate Daily Log',
    description:
      'Speak about the day\'s work and the AI will format it into a structured daily log entry.',
    buttonLabel: 'Dictate Daily Log',
    usesVoice: true,
  },
  progress_recap: {
    icon: <BarChart3 className="h-5 w-5" />,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    title: 'Generate Progress Recap',
    description:
      'AI will compile project activity into a progress recap with highlights, milestones, and upcoming work.',
    buttonLabel: 'Generate Progress Recap',
    usesVoice: false,
  },
  ai_summary: {
    icon: <Camera className="h-5 w-5" />,
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    title: 'Generate Photo Summary',
    description:
      'Select photos from the project to generate an AI summary of visible work and conditions.',
    buttonLabel: 'Generate Photo Summary',
    usesVoice: false,
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AIPageActions({
  pageType,
  projectId,
  onContentGenerated,
}: AIPageActionsProps) {
  const [showVoice, setShowVoice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = ACTION_CONFIG[pageType];

  // ── Voice transcript handler ────────────────────────────────────────────
  const handleTranscript = async (transcript: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await processVoiceTranscript<Record<string, unknown>>(
        transcript,
        pageType as VoiceTargetType,
        `Project ID: ${projectId}`
      );

      const title =
        (result.title as string) ||
        config.title + ' - ' + new Date().toLocaleDateString();
      const body = formatAsPageContent(result, pageType);

      onContentGenerated({ title, body });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process transcript');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Progress recap (no voice) ───────────────────────────────────────────
  const handleGenerateRecap = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await processVoiceTranscript<Record<string, unknown>>(
        'Generate a progress recap for this project based on recent activity.',
        'progress_recap',
        `Project ID: ${projectId}`
      );

      const title =
        (result.title as string) ||
        'Progress Recap - ' + new Date().toLocaleDateString();
      const body = formatAsPageContent(result, 'progress_recap');

      onContentGenerated({ title, body });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recap');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Action handler ──────────────────────────────────────────────────────
  const handleAction = () => {
    if (pageType === 'ai_summary') {
      // Photo summary is a placeholder for now
      return;
    }

    if (config.usesVoice) {
      setShowVoice(true);
    } else {
      handleGenerateRecap();
    }
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              config.iconBg,
              config.iconColor
            )}
          >
            {config.icon}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {config.title}
              </h3>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                <Sparkles className="h-2.5 w-2.5" />
                AI
              </span>
            </div>

            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              {config.description}
            </p>

            {/* Photo summary info text */}
            {pageType === 'ai_summary' && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 text-sm text-purple-700">
                <Camera className="h-4 w-4 shrink-0" />
                Select photos from the project to generate an AI summary
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex flex-1 flex-col gap-1">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      handleAction();
                    }}
                    className="self-start text-sm font-medium text-red-700 underline underline-offset-2 hover:text-red-800"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Action button */}
            {!error && (
              <div className="mt-4">
                {isLoading ? (
                  <Button disabled className="gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </Button>
                ) : (
                  <Button onClick={handleAction}>
                    {config.usesVoice && <Mic className="h-4 w-4" />}
                    {!config.usesVoice && pageType === 'progress_recap' && (
                      <BarChart3 className="h-4 w-4" />
                    )}
                    {!config.usesVoice && pageType === 'ai_summary' && (
                      <Camera className="h-4 w-4" />
                    )}
                    {config.buttonLabel}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Voice capture modal */}
      <VoiceCapture
        isOpen={showVoice}
        onClose={() => setShowVoice(false)}
        onTranscript={handleTranscript}
        title={config.title}
      />
    </>
  );
}
