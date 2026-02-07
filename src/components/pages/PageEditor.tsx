import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import LinkExt from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import UnderlineExt from '@tiptap/extension-underline';
import {
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link,
  Image,
  Minus,
  Undo2,
  Redo2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { PageType } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PageEditorProps {
  page: {
    id: string;
    title: string;
    content: Record<string, unknown>;
    pageType: PageType;
  };
  onSave: (data: { title: string; content: Record<string, unknown> }) => void;
  onBack: () => void;
  isSaving?: boolean;
  projectName?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_TYPE_CONFIG: Record<
  PageType,
  { label: string; bg: string; text: string }
> = {
  general: {
    label: 'General',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
  },
  walkthrough_note: {
    label: 'Walkthrough Note',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
  },
  progress_recap: {
    label: 'Progress Recap',
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
  },
  daily_log: {
    label: 'Daily Log',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
  },
  ai_summary: {
    label: 'AI Summary',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
  },
  proposal: {
    label: 'Proposal',
    bg: 'bg-cyan-100',
    text: 'text-cyan-700',
  },
};

const AUTOSAVE_DELAY_MS = 3000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PageEditor({
  page,
  onSave,
  onBack,
  isSaving = false,
  projectName,
}: PageEditorProps) {
  const [title, setTitle] = useState(page.title);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>(
    'idle'
  );

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTitle = useRef(title);

  // Keep the ref in sync so the autosave closure always reads the latest title
  useEffect(() => {
    latestTitle.current = title;
  }, [title]);

  // ── TipTap editor ──────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      ImageExt.configure({ inline: false, allowBase64: true }),
      LinkExt.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: 'text-blue-600 underline cursor-pointer' },
      }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
      UnderlineExt,
    ],
    content: page.content as Record<string, unknown>,
    editorProps: {
      attributes: {
        class:
          'outline-none min-h-[calc(100vh-12rem)] px-6 py-4',
      },
    },
    onUpdate: () => {
      scheduleSave();
    },
  });

  // ── Auto-save logic ────────────────────────────────────────────────────
  const scheduleSave = useCallback(() => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }
    setSaveStatus('idle');
    autosaveTimer.current = setTimeout(() => {
      if (!editor) return;
      setSaveStatus('saving');
      onSave({
        title: latestTitle.current,
        content: editor.getJSON() as Record<string, unknown>,
      });
      // Optimistically mark as saved after a brief delay
      setTimeout(() => setSaveStatus('saved'), 400);
    }, AUTOSAVE_DELAY_MS);
  }, [editor, onSave]);

  // Trigger autosave when title changes
  useEffect(() => {
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  // Sync external isSaving prop
  useEffect(() => {
    if (isSaving) setSaveStatus('saving');
  }, [isSaving]);

  // ── Toolbar actions ────────────────────────────────────────────────────
  const handleLinkInsert = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Enter URL', previousUrl ?? 'https://');

    if (url === null) return; // cancelled
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run();
  }, [editor]);

  const handleImagePlaceholder = useCallback(() => {
    alert('Photo embedding coming soon');
  }, []);

  // ── Badge config ───────────────────────────────────────────────────────
  const typeConfig = PAGE_TYPE_CONFIG[page.pageType];

  if (!editor) return null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Go back"
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full truncate border-0 bg-transparent text-lg font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 focus:border-b focus:border-slate-300"
            placeholder="Untitled page"
          />
          {projectName && (
            <span className="truncate text-xs text-slate-500">
              {projectName}
            </span>
          )}
        </div>

        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
            typeConfig.bg,
            typeConfig.text
          )}
        >
          {typeConfig.label}
        </span>

        <span className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
          {(saveStatus === 'saving' || isSaving) && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving&hellip;
            </>
          )}
          {saveStatus === 'saved' && !isSaving && <>Saved</>}
        </span>
      </header>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="sticky top-[57px] z-20 flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1">
        {/* Inline formatting */}
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Underline"
        >
          <Underline className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Headings */}
        <ToolbarButton
          active={editor.isActive('heading', { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          aria-label="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          aria-label="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          aria-label="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Lists */}
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Ordered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Link / Image / HR */}
        <ToolbarButton
          active={editor.isActive('link')}
          onClick={handleLinkInsert}
          aria-label="Insert link"
        >
          <Link className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={handleImagePlaceholder}
          aria-label="Insert image"
        >
          <Image className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          aria-label="Horizontal rule"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarSeparator />

        {/* Undo / Redo */}
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          aria-label="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          aria-label="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* ── Editor ─────────────────────────────────────────────────────── */}
      <div className="flex-1">
        <EditorContent
          editor={editor}
          className={cn(
            'prose prose-slate max-w-none',
            // Headings
            '[&_.tiptap_h1]:text-2xl [&_.tiptap_h1]:font-bold [&_.tiptap_h1]:mt-6 [&_.tiptap_h1]:mb-3',
            '[&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-semibold [&_.tiptap_h2]:mt-5 [&_.tiptap_h2]:mb-2',
            '[&_.tiptap_h3]:text-lg [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:mt-4 [&_.tiptap_h3]:mb-2',
            // Paragraphs & lists
            '[&_.tiptap_p]:my-2 [&_.tiptap_p]:leading-relaxed',
            '[&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-6 [&_.tiptap_ul]:my-2',
            '[&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-6 [&_.tiptap_ol]:my-2',
            '[&_.tiptap_li]:my-0.5',
            // Links
            '[&_.tiptap_a]:text-blue-600 [&_.tiptap_a]:underline',
            // HR
            '[&_.tiptap_hr]:my-6 [&_.tiptap_hr]:border-slate-300',
            // Images
            '[&_.tiptap_img]:max-w-full [&_.tiptap_img]:rounded-lg [&_.tiptap_img]:my-4',
            // Placeholder
            '[&_.tiptap_p.is-editor-empty:first-child::before]:text-slate-400 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0'
          )}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ToolbarButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  children: React.ReactNode;
}

function ToolbarButton({
  active,
  children,
  className,
  disabled,
  ...props
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none',
        active && 'bg-slate-200 text-slate-900',
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="mx-1 h-5 w-px bg-slate-300" />;
}
