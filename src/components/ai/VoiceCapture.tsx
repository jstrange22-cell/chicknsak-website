import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Square, RotateCcw, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscript: (text: string) => void;
  title?: string;
}

type RecordingState = 'idle' | 'recording' | 'done';

// ---------------------------------------------------------------------------
// Speech Recognition setup
// ---------------------------------------------------------------------------

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VoiceCapture({
  isOpen,
  onClose,
  onTranscript,
  title = 'Voice Capture',
}: VoiceCaptureProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isSpeechAvailable = Boolean(SpeechRecognition);

  // ── Cleanup on unmount / close ──────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      setState('idle');
      setTranscript('');
      setInterimTranscript('');
      setDuration(0);
      setError(null);
    }
  }, [isOpen, cleanup]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // ── Start recording ─────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!SpeechRecognition) return;

    setError(null);
    setTranscript('');
    setInterimTranscript('');
    setDuration(0);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let final = '';
      let interim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      setTranscript(final);
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      // "aborted" fires when we intentionally stop — not a real error
      if (event.error === 'aborted') return;
      setError(`Speech recognition error: ${event.error}`);
      stopRecording();
    };

    recognition.onend = () => {
      // If we're still supposed to be recording the browser ended on its own;
      // transition to done so the user can still use the transcript.
      if (state === 'recording') {
        setState('done');
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setState('recording');

    // Timer
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }, [state]);

  // ── Stop recording ──────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState('done');
  }, []);

  // ── Re-record ───────────────────────────────────────────────────────────
  const handleReRecord = useCallback(() => {
    cleanup();
    setState('idle');
    setTranscript('');
    setInterimTranscript('');
    setDuration(0);
    setError(null);
  }, [cleanup]);

  // ── Process / submit ────────────────────────────────────────────────────
  const handleProcess = useCallback(() => {
    const text = transcript.trim();
    if (!text) return;
    onTranscript(text);
    onClose();
  }, [transcript, onTranscript, onClose]);

  // ── Manual submit (fallback textarea) ───────────────────────────────────
  const handleManualSubmit = useCallback(() => {
    const text = transcript.trim();
    if (!text) return;
    onTranscript(text);
    onClose();
  }, [transcript, onTranscript, onClose]);

  // ── Don't render when closed ────────────────────────────────────────────
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={cn(
          'relative z-10 flex flex-col bg-white shadow-2xl',
          // Full-screen on mobile, centered modal on desktop
          'h-full w-full sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-lg sm:rounded-2xl'
        )}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8 sm:px-6">
          {!isSpeechAvailable ? (
            /* ── Fallback: manual text input ─────────────────────────── */
            <div className="flex w-full flex-col gap-4">
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <MicOff className="h-4 w-4 shrink-0" />
                Speech recognition not available. Type your text instead.
              </div>

              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Type your notes here..."
                className="min-h-[160px] resize-none"
                autoFocus
              />

              <Button
                onClick={handleManualSubmit}
                disabled={!transcript.trim()}
                className="w-full"
              >
                <Send className="h-4 w-4" />
                Process
              </Button>
            </div>
          ) : state === 'idle' ? (
            /* ── Idle: tap to start ──────────────────────────────────── */
            <div className="flex flex-col items-center gap-6">
              <button
                type="button"
                onClick={startRecording}
                className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all hover:bg-slate-200 active:scale-95"
                aria-label="Start recording"
              >
                <Mic className="h-12 w-12" />
              </button>
              <p className="text-sm text-slate-500">Tap to start recording</p>
            </div>
          ) : state === 'recording' ? (
            /* ── Recording: live transcript + timer ──────────────────── */
            <div className="flex w-full flex-col items-center gap-6">
              {/* Pulsing mic */}
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-red-400 animate-pulse" />
                <button
                  type="button"
                  onClick={stopRecording}
                  className="relative flex h-28 w-28 items-center justify-center rounded-full bg-red-500 text-white transition-all active:scale-95"
                  aria-label="Recording in progress"
                >
                  <Mic className="h-12 w-12" />
                </button>
              </div>

              {/* Timer */}
              <p className="font-mono text-2xl font-semibold text-slate-700">
                {formatDuration(duration)}
              </p>

              {/* Live transcript */}
              <div className="w-full rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-sm text-slate-700">
                  {transcript}
                  {interimTranscript && (
                    <span className="text-slate-400">{interimTranscript}</span>
                  )}
                  {!transcript && !interimTranscript && (
                    <span className="text-slate-400">Listening...</span>
                  )}
                </p>
              </div>

              {/* Stop button */}
              <Button variant="destructive" onClick={stopRecording}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
            </div>
          ) : (
            /* ── Done: editable transcript + actions ─────────────────── */
            <div className="flex w-full flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  Transcript
                </p>
                <span className="text-xs text-slate-400">
                  {formatDuration(duration)}
                </span>
              </div>

              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="min-h-[160px] resize-none"
              />

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleReRecord}
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4" />
                  Re-record
                </Button>
                <Button
                  onClick={handleProcess}
                  disabled={!transcript.trim()}
                  className="flex-1"
                >
                  <Send className="h-4 w-4" />
                  Process
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
