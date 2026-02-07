import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  User,
  Sparkles,
  DollarSign,
  BookOpen,
  Wrench,
  Loader2,
  Trash2,
  FileText,
  ShieldAlert,
  CalendarDays,
  FileQuestion,
  ClipboardCheck,
  Copy,
  Check,
  Mic,
  Calculator,
  Landmark,
  Ruler,
  HardHat,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  sendJobMateMessage,
  resetMockCounters,
  type JobMateMode,
  type EstimateOutput,
} from '@/lib/ai/jobmate';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode: JobMateMode;
  timestamp: Date;
  estimate?: EstimateOutput;
  jobtreadPayload?: Record<string, unknown>;
}

interface QuickAction {
  id: JobMateMode;
  label: string;
  icon: React.ElementType;
  color: string;
  prompt: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const quickActions: QuickAction[] = [
  {
    id: 'estimate',
    label: 'Estimate',
    icon: DollarSign,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    prompt: 'I need a construction estimate. What details do you need to get started?',
    description: 'Room-level estimates with line items and markups',
  },
  {
    id: 'walkthrough',
    label: 'Walkthrough',
    icon: Mic,
    color: 'bg-violet-50 text-violet-600 border-violet-200',
    prompt: 'I want to describe work room by room and have you build an estimate. Ready?',
    description: 'Voice-to-estimate — describe work, get line items',
  },
  {
    id: 'takeoff',
    label: 'Takeoff',
    icon: Ruler,
    color: 'bg-sky-50 text-sky-600 border-sky-200',
    prompt: 'I need help with a quantity takeoff. What measurements do you need?',
    description: 'Area, linear, and volume calculations',
  },
  {
    id: 'codes',
    label: 'Codes',
    icon: BookOpen,
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    prompt: 'I have a building code question. Which code are you looking up?',
    description: 'IRC, IBC, NEC, plumbing, and energy code lookups',
  },
  {
    id: 'scope',
    label: 'Scope',
    icon: FileText,
    color: 'bg-teal-50 text-teal-600 border-teal-200',
    prompt: 'I need a scope of work drafted. What trade or project type?',
    description: 'Professional scopes of work and proposals',
  },
  {
    id: 'financial',
    label: 'Financial',
    icon: Landmark,
    color: 'bg-amber-50 text-amber-600 border-amber-200',
    prompt: 'I need help with invoicing, change orders, or financial sync. What do you need?',
    description: 'Invoices, change orders, QuickBooks & JobTread sync',
  },
  {
    id: 'safety',
    label: 'Safety',
    icon: ShieldAlert,
    color: 'bg-orange-50 text-orange-600 border-orange-200',
    prompt: 'I have a safety question or need a checklist. What activity or concern?',
    description: 'OSHA compliance, toolbox talks, and JHAs',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: CalendarDays,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    prompt: 'I need project scheduling help. What type of project or phase?',
    description: 'Timeline planning, sequencing, and coordination',
  },
  {
    id: 'rfi',
    label: 'RFI',
    icon: FileQuestion,
    color: 'bg-cyan-50 text-cyan-600 border-cyan-200',
    prompt: 'I need to write an RFI. What is the issue or question?',
    description: 'Requests for Information with proper format',
  },
  {
    id: 'punchlist',
    label: 'Punch List',
    icon: ClipboardCheck,
    color: 'bg-pink-50 text-pink-600 border-pink-200',
    prompt: 'I need a punch list. What area or trade?',
    description: 'Systematic walkthrough checklists by trade',
  },
];

// ---------------------------------------------------------------------------
// Copy Button Component
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors mt-1"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          <span className="text-emerald-500">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Estimate Summary Card (shown when AI returns structured estimate)
// ---------------------------------------------------------------------------

function EstimateSummaryCard({ estimate }: { estimate: EstimateOutput }) {
  const fmt = (cents: number) =>
    '$' + (cents).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Calculator className="h-4 w-4 text-emerald-600" />
        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
          Estimate Summary
        </span>
      </div>

      {/* Areas */}
      {estimate.areas.map((area, i) => (
        <div key={i} className="mb-2">
          <p className="text-xs font-semibold text-slate-700">{area.name}</p>
          <div className="ml-2">
            {area.lineItems.slice(0, 5).map((item, j) => (
              <div key={j} className="flex justify-between text-[11px] text-slate-600">
                <span className="truncate mr-2">{item.description}</span>
                <span className="shrink-0 font-mono">{fmt(item.totalCost)}</span>
              </div>
            ))}
            {area.lineItems.length > 5 && (
              <p className="text-[10px] text-slate-400 italic">
                +{area.lineItems.length - 5} more items
              </p>
            )}
            <div className="flex justify-between text-[11px] font-semibold text-slate-700 border-t border-emerald-200 mt-1 pt-1">
              <span>Subtotal</span>
              <span className="font-mono">{fmt(area.subtotal)}</span>
            </div>
          </div>
        </div>
      ))}

      {/* Totals */}
      <div className="border-t border-emerald-300 pt-2 mt-2 space-y-0.5">
        <div className="flex justify-between text-xs text-slate-600">
          <span>Hard Costs</span>
          <span className="font-mono">{fmt(estimate.hardCosts)}</span>
        </div>
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>Profit ({estimate.markup.profitPercent}%)</span>
          <span className="font-mono">{fmt(estimate.profitAmount)}</span>
        </div>
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>Overhead ({estimate.markup.overheadPercent}%)</span>
          <span className="font-mono">{fmt(estimate.overheadAmount)}</span>
        </div>
        {estimate.taxAmount > 0 && (
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Tax ({estimate.markup.taxPercent}%)</span>
            <span className="font-mono">{fmt(estimate.taxAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>Contingency ({estimate.markup.contingencyPercent}%)</span>
          <span className="font-mono">{fmt(estimate.contingencyAmount)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold text-emerald-700 border-t border-emerald-300 pt-1.5 mt-1.5">
          <span>Total Price</span>
          <span className="font-mono">{fmt(estimate.totalPrice)}</span>
        </div>
        <div className="flex justify-between text-[11px] text-emerald-600">
          <span>Gross Margin</span>
          <span className="font-semibold">{estimate.grossMarginPercent.toFixed(1)}%</span>
        </div>
      </div>

      {/* Sync buttons */}
      <div className="flex gap-2 mt-3">
        <button className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 transition-colors">
          <Wrench className="h-3 w-3" />
          Save Estimate
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-[11px] font-medium text-blue-700 hover:bg-blue-50 transition-colors">
          <HardHat className="h-3 w-3" />
          Sync to JobTread
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Bubble Component
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-2.5 max-w-full',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <HardHat className="h-4 w-4" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'rounded-2xl px-4 py-2.5 max-w-[85%] md:max-w-[75%]',
          isUser
            ? 'bg-blue-500 text-white rounded-br-md'
            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
        )}
      >
        {/* Mode badge for AI messages */}
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              JobMate &bull;{' '}
              {quickActions.find((a) => a.id === message.mode)?.label || 'General'}
            </span>
          </div>
        )}

        {/* Message content -- render markdown-like formatting */}
        <div
          className={cn(
            'text-sm leading-relaxed whitespace-pre-wrap break-words',
            isUser ? 'text-white' : 'text-slate-700'
          )}
        >
          {message.content.split('\n').map((line, i) => {
            // Bold text
            const boldParsed = line.replace(
              /\*\*(.*?)\*\*/g,
              '<strong>$1</strong>'
            );
            // Inline code
            const codeParsed = boldParsed.replace(
              /`(.*?)`/g,
              '<code class="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-xs font-mono">$1</code>'
            );

            return (
              <span key={i}>
                <span dangerouslySetInnerHTML={{ __html: codeParsed }} />
                {i < message.content.split('\n').length - 1 && <br />}
              </span>
            );
          })}
        </div>

        {/* Estimate Summary Card */}
        {!isUser && message.estimate && (
          <EstimateSummaryCard estimate={message.estimate} />
        )}

        {/* Footer: timestamp + copy */}
        <div className={cn(
          'flex items-center gap-3 mt-1.5',
          isUser ? 'justify-end' : 'justify-between'
        )}>
          <p
            className={cn(
              'text-[10px]',
              isUser ? 'text-blue-200' : 'text-slate-400'
            )}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          {!isUser && <CopyButton text={message.content} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typing Indicator
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white">
        <HardHat className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-bl-md bg-white border border-slate-200 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          <span className="ml-2 text-xs text-slate-400">JobMate is thinking...</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome Screen
// ---------------------------------------------------------------------------

function WelcomeScreen({
  onQuickAction,
}: {
  onQuickAction: (action: QuickAction) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-6">
      {/* Logo */}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mb-4">
        <HardHat className="h-8 w-8 text-white" />
      </div>

      <h2 className="text-xl font-bold text-slate-900 mb-1">
        JobMate
      </h2>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
        Your AI construction estimating and management assistant.
        Estimates, takeoffs, codes, scopes, financials, and more.
      </p>

      {/* Quick action grid */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-2">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => onQuickAction(action)}
            className={cn(
              'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all hover:shadow-md active:scale-[0.98] touch-manipulation',
              action.color
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/60 mt-0.5">
              <action.icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{action.label}</p>
              <p className="text-[11px] opacity-70 leading-snug mt-0.5 line-clamp-2">
                {action.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Features summary */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
        {['Room-Level Estimates', 'ZIP Pricing', 'JobTread Sync', 'QuickBooks', 'Voice-to-Estimate'].map((tag) => (
          <span key={tag} className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-medium text-amber-700">
            {tag}
          </span>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-slate-400 mt-4 text-center max-w-sm leading-relaxed">
        AI provides construction guidance and preliminary estimates.
        Not a substitute for professional engineering or architectural advice.
        Verify with qualified professionals before proceeding.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main JobMate Page
// ---------------------------------------------------------------------------

export default function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<JobMateMode>('general');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = useCallback(
    async (text: string, mode?: JobMateMode) => {
      if (!text.trim() || isLoading) return;

      const effectiveMode = mode || activeMode;
      const generateEstimate = effectiveMode === 'estimate' || effectiveMode === 'walkthrough';

      // Add user message
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
        mode: effectiveMode,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      try {
        // Build conversation history from existing messages
        const conversationHistory = messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        // Call the JobMate AI service
        const response = await sendJobMateMessage({
          message: text.trim(),
          mode: effectiveMode,
          conversationHistory,
          generateEstimate,
        });

        const aiMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.content,
          mode: effectiveMode,
          timestamp: new Date(),
          estimate: response.estimate as EstimateOutput | undefined,
          jobtreadPayload: response.jobtreadPayload,
        };

        setMessages((prev) => [...prev, aiMessage]);
      } catch (err) {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Sorry, I encountered an error processing your request. Please try again.\n\n_Error: ${err instanceof Error ? err.message : 'Unknown error'}_`,
          mode: effectiveMode,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
    },
    [activeMode, isLoading, messages]
  );

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      setActiveMode(action.id);
      sendMessage(action.prompt, action.id);
    },
    [sendMessage]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setActiveMode('general');
    resetMockCounters();
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] md:h-[calc(100vh-1.5rem)]">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
              <HardHat className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                JobMate
              </h1>
              <p className="text-[11px] text-slate-500">
                Estimates &bull; Takeoffs &bull; Codes &bull; Financials &bull; More
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode indicator */}
            {activeMode !== 'general' && (
              <span className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                <Sparkles className="h-3.5 w-3.5" />
                {quickActions.find((a) => a.id === activeMode)?.label || 'General'}
              </span>
            )}

            {/* Clear Chat */}
            {hasMessages && (
              <button
                onClick={clearChat}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Action Chips (shown when there are messages) */}
        {hasMessages && (
          <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                disabled={isLoading}
                className={cn(
                  'flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-all touch-manipulation',
                  activeMode === action.id
                    ? action.color
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
              >
                <action.icon className="h-3 w-3" />
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50">
        {!hasMessages ? (
          <WelcomeScreen onQuickAction={handleQuickAction} />
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activeMode === 'estimate'
                  ? 'Describe the project for an estimate...'
                  : activeMode === 'walkthrough'
                  ? 'Describe the work room by room...'
                  : activeMode === 'takeoff'
                  ? 'Enter dimensions or describe measurements...'
                  : 'Ask JobMate about construction, codes, costs...'
              }
              rows={1}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-amber-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all touch-manipulation"
              style={{
                minHeight: '42px',
                maxHeight: '120px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={cn(
              'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl transition-all touch-manipulation',
              input.trim() && !isLoading
                ? 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-sm shadow-amber-500/25'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>

        <p className="text-[10px] text-slate-400 mt-1.5 text-center">
          JobMate provides preliminary estimates and construction guidance.
          Verify with qualified professionals. Connect API keys in Settings for live AI.
        </p>
      </div>
    </div>
  );
}
