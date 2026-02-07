import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  FileText,
  Clock,
  Tag,
  Search,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import type { VoiceNote } from '@/types';

// ---------------------------------------------------------------------------
// Mock Transcription (simulates AI processing)
// ---------------------------------------------------------------------------

const MOCK_TRANSCRIPTIONS = [
  'Inspected the southeast corner of the foundation. Found minor cracking along the expansion joint that needs to be sealed before framing begins. Recommend using polyurethane sealant. Also noted that the grade slopes toward the structure approximately two inches over ten feet, which needs to be corrected for proper drainage.',
  'Met with the homeowner today to review the deck design changes. They want to extend the deck by four feet on the north side and add a built-in bench along the railing. Updated the material estimate accordingly. Will need an additional twelve composite deck boards and six extra posts for the bench supports.',
  'Weather delay this morning due to heavy rain. Crew stood down until eleven AM. Resumed work on the second floor framing after the rain stopped. Completed the load-bearing wall on the east side. Tomorrow we plan to start on the roof trusses if weather permits.',
  'Safety walkthrough completed. All harnesses and fall protection equipment inspected and in good condition. Reminded the crew about proper ladder placement and three-point contact. No safety violations observed. Fire extinguisher on site is fully charged and accessible.',
  'Subcontractor meeting with the electrical team. They will begin rough-in wiring next Monday. Need to have all interior walls framed and inspected before they can start. Plumbing rough-in is scheduled for the following week. Coordinating with HVAC contractor to avoid conflicts in the ceiling chase.',
];

function getMockTranscription(): string {
  return MOCK_TRANSCRIPTIONS[Math.floor(Math.random() * MOCK_TRANSCRIPTIONS.length)];
}

// ---------------------------------------------------------------------------
// Sample Data
// ---------------------------------------------------------------------------

function createSampleNotes(): VoiceNote[] {
  const now = new Date();
  return [
    {
      id: 'vn-1',
      companyId: 'company-1',
      userId: 'user-1',
      title: 'Foundation Inspection Notes',
      audioUrl: undefined,
      transcription:
        'Inspected the southeast corner of the foundation. Found minor cracking along the expansion joint that needs to be sealed before framing begins. Recommend using polyurethane sealant.',
      duration: 47,
      projectId: 'proj-1',
      tags: ['inspection', 'foundation'],
      isTranscribing: false,
      createdAt: Timestamp.fromDate(new Date(now.getTime() - 2 * 60 * 60 * 1000)),
      updatedAt: Timestamp.fromDate(new Date(now.getTime() - 2 * 60 * 60 * 1000)),
    },
    {
      id: 'vn-2',
      companyId: 'company-1',
      userId: 'user-1',
      title: 'Deck Design Changes',
      audioUrl: undefined,
      transcription:
        'Met with the homeowner today to review the deck design changes. They want to extend the deck by four feet on the north side and add a built-in bench along the railing. Updated the material estimate accordingly.',
      duration: 93,
      projectId: 'proj-2',
      tags: ['design', 'client-meeting'],
      isTranscribing: false,
      createdAt: Timestamp.fromDate(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      updatedAt: Timestamp.fromDate(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
    },
    {
      id: 'vn-3',
      companyId: 'company-1',
      userId: 'user-1',
      title: 'Weather Delay Report',
      audioUrl: undefined,
      transcription:
        'Weather delay this morning due to heavy rain. Crew stood down until eleven AM. Resumed work on the second floor framing after the rain stopped. Completed the load-bearing wall on the east side.',
      duration: 31,
      projectId: 'proj-1',
      tags: ['weather', 'daily-log'],
      isTranscribing: false,
      createdAt: Timestamp.fromDate(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)),
      updatedAt: Timestamp.fromDate(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)),
    },
    {
      id: 'vn-4',
      companyId: 'company-1',
      userId: 'user-1',
      title: 'Safety Walkthrough',
      audioUrl: undefined,
      transcription:
        'Safety walkthrough completed. All harnesses and fall protection equipment inspected and in good condition. Reminded the crew about proper ladder placement and three-point contact. No safety violations observed.',
      duration: 62,
      projectId: 'proj-3',
      tags: ['safety'],
      isTranscribing: false,
      createdAt: Timestamp.fromDate(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)),
      updatedAt: Timestamp.fromDate(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)),
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNoteDate(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffHours < 48) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Waveform Animation Component
// ---------------------------------------------------------------------------

function WaveformAnimation({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-16">
      {Array.from({ length: 32 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-[3px] rounded-full transition-all',
            isActive ? 'bg-red-400' : 'bg-slate-300'
          )}
          style={{
            height: isActive ? `${Math.random() * 48 + 8}px` : '8px',
            animation: isActive ? `waveform ${0.3 + Math.random() * 0.5}s ease-in-out infinite alternate` : 'none',
            animationDelay: `${i * 0.03}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recording Panel
// ---------------------------------------------------------------------------

interface RecordingPanelProps {
  isRecording: boolean;
  recordingDuration: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancel: () => void;
  hasPermission: boolean | null;
}

function RecordingPanel({
  isRecording,
  recordingDuration,
  onStartRecording,
  onStopRecording,
  onCancel,
  hasPermission,
}: RecordingPanelProps) {
  if (isRecording) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            {/* Waveform */}
            <WaveformAnimation isActive={true} />

            {/* Timer */}
            <div className="flex items-center justify-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-2xl font-bold text-red-600 font-mono tabular-nums">
                {formatDuration(recordingDuration)}
              </span>
            </div>

            <p className="text-sm text-slate-500">Recording in progress...</p>

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="gap-1.5"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <button
                onClick={onStopRecording}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 active:scale-95 transition-all"
              >
                <Square className="h-6 w-6" fill="white" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <WaveformAnimation isActive={false} />
          <p className="text-sm text-slate-500">
            {hasPermission === false
              ? 'Microphone access denied. Please enable microphone permissions in your browser settings.'
              : 'Tap the microphone to start recording a voice note'}
          </p>
          <button
            onClick={onStartRecording}
            disabled={hasPermission === false}
            className={cn(
              'flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition-all active:scale-95 mx-auto',
              hasPermission === false
                ? 'bg-slate-300 text-slate-500 shadow-slate-300/30 cursor-not-allowed'
                : 'bg-red-500 text-white shadow-red-500/30 hover:bg-red-600 hover:shadow-red-500/40'
            )}
          >
            {hasPermission === false ? (
              <MicOff className="h-8 w-8" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Voice Note Card
// ---------------------------------------------------------------------------

interface VoiceNoteCardProps {
  note: VoiceNote;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onDelete: () => void;
}

function VoiceNoteCard({ note, isPlaying, onTogglePlay, onDelete }: VoiceNoteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const transcriptionPreview = note.transcription
    ? note.transcription.length > 120
      ? note.transcription.slice(0, 120) + '...'
      : note.transcription
    : null;

  return (
    <Card className={cn('transition-all', note.isTranscribing && 'border-blue-200 bg-blue-50/30')}>
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Play Button */}
            <button
              onClick={onTogglePlay}
              disabled={note.isTranscribing}
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all',
                isPlaying
                  ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                  : note.isTranscribing
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'
              )}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" fill="white" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
              )}
            </button>

            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {note.title}
              </h3>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(note.duration)}
                </span>
                <span>{formatNoteDate(note.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Delete Button */}
          <button
            onClick={onDelete}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Transcription Status / Preview */}
        {note.isTranscribing && (
          <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Transcribing audio...</span>
          </div>
        )}

        {transcriptionPreview && !note.isTranscribing && (
          <div className="mt-3">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-600 leading-relaxed">
                {isExpanded ? note.transcription : transcriptionPreview}
              </p>
            </div>

            {note.transcription && note.transcription.length > 120 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 mt-2 ml-6 text-xs text-blue-500 hover:text-blue-700 font-medium"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Show full transcription
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Tags */}
        {note.tags.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <Tag className="h-3 w-3 text-slate-400" />
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Voice Notes Page
// ---------------------------------------------------------------------------

export default function VoiceNotesPage() {
  // State
  const [notes, setNotes] = useState<VoiceNote[]>(createSampleNotes);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Recording Logic
  // ---------------------------------------------------------------------------

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setHasPermission(true);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch {
      setHasPermission(false);
      console.error('Microphone permission denied');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    const duration = recordingDuration;

    mediaRecorderRef.current.onstop = () => {
      // Create audio blob
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const audioUrl = URL.createObjectURL(audioBlob);

      const now = Timestamp.fromDate(new Date());
      const newNote: VoiceNote = {
        id: `vn-${Date.now()}`,
        companyId: 'company-1',
        userId: 'user-1',
        title: `Voice Note - ${new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })}`,
        audioUrl,
        transcription: undefined,
        duration: Math.max(duration, 1),
        projectId: undefined,
        tags: [],
        isTranscribing: true,
        createdAt: now,
        updatedAt: now,
      };

      setNotes((prev) => [newNote, ...prev]);

      // Simulate AI transcription (2-4 second delay)
      const transcriptionDelay = 2000 + Math.random() * 2000;
      setTimeout(() => {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === newNote.id
              ? {
                  ...n,
                  transcription: getMockTranscription(),
                  isTranscribing: false,
                  updatedAt: Timestamp.fromDate(new Date()),
                }
              : n
          )
        );
      }, transcriptionDelay);

      // Cleanup stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    mediaRecorderRef.current.stop();
    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [recordingDuration]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setRecordingDuration(0);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Playback Logic (simple toggle for now)
  // ---------------------------------------------------------------------------

  const togglePlay = useCallback((noteId: string) => {
    setPlayingNoteId((prev) => (prev === noteId ? null : noteId));
  }, []);

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const deleteNote = useCallback((noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    if (playingNoteId === noteId) {
      setPlayingNoteId(null);
    }
  }, [playingNoteId]);

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  // Collect all unique tags from notes
  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags))).sort();

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      !searchQuery ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.transcription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTag = !filterTag || note.tags.includes(filterTag);

    return matchesSearch && matchesTag;
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Waveform keyframes injected via style tag */}
      <style>{`
        @keyframes waveform {
          0% { height: 8px; }
          100% { height: 48px; }
        }
      `}</style>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Voice Notes</h1>
        <p className="text-slate-500 mt-1">
          Record and transcribe field notes with AI
        </p>
      </div>

      {/* Recording Panel */}
      <RecordingPanel
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onCancel={cancelRecording}
        hasPermission={hasPermission}
      />

      {/* Search and Filter */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes, transcriptions, tags..."
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            <button
              onClick={() => setFilterTag(null)}
              className={cn(
                'shrink-0 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                filterTag === null
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={cn(
                  'shrink-0 inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  filterTag === tag
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notes Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'}
          {searchQuery || filterTag ? ' found' : ''}
        </p>
      </div>

      {/* Notes List */}
      <div className="space-y-3">
        {filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <VoiceNoteCard
              key={note.id}
              note={note}
              isPlaying={playingNoteId === note.id}
              onTogglePlay={() => togglePlay(note.id)}
              onDelete={() => deleteNote(note.id)}
            />
          ))
        ) : (
          <div className="py-12 text-center">
            <div className="flex justify-center mb-3">
              <div className="p-4 rounded-full bg-slate-100">
                <Mic className="h-8 w-8 text-slate-300" />
              </div>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              {searchQuery || filterTag ? 'No matching notes' : 'No voice notes yet'}
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {searchQuery || filterTag
                ? 'Try adjusting your search or filter to find what you are looking for.'
                : 'Tap the microphone above to record your first voice note. It will be automatically transcribed using AI.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
