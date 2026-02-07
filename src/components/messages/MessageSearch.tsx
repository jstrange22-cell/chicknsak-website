import { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Message } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageSearchProps {
  searchQuery: string;
  searchResults: Message[];
  onSearch: (query: string) => void;
  onClear: () => void;
  onSelectResult: (messageId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageSearch({
  searchQuery,
  searchResults,
  onSearch,
  onClear,
  onSelectResult,
}: MessageSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchResults]);

  const handleOpen = () => {
    setIsExpanded(true);
    // Focus input after a tick to allow render
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleClose = () => {
    setIsExpanded(false);
    onClear();
    setSelectedIndex(-1);
  };

  const navigateResult = (direction: 'up' | 'down') => {
    if (searchResults.length === 0) return;

    let newIndex: number;
    if (direction === 'down') {
      newIndex = selectedIndex < searchResults.length - 1 ? selectedIndex + 1 : 0;
    } else {
      newIndex = selectedIndex > 0 ? selectedIndex - 1 : searchResults.length - 1;
    }

    setSelectedIndex(newIndex);
    onSelectResult(searchResults[newIndex].id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter') {
      if (searchResults.length > 0) {
        navigateResult('down');
      }
    }
  };

  // Highlight matching text in a string
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  if (!isExpanded) {
    return (
      <button
        onClick={handleOpen}
        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        aria-label="Search messages"
      >
        <Search className="h-4 w-4 text-slate-500" />
      </button>
    );
  }

  return (
    <div className="border-b border-slate-200 bg-white">
      {/* Search input bar */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search messages..."
          className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
        />

        {searchQuery && (
          <span className="text-xs text-slate-400 shrink-0">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Navigation arrows */}
        {searchResults.length > 0 && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => navigateResult('up')}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
              aria-label="Previous result"
            >
              <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
            </button>
            <button
              onClick={() => navigateResult('down')}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
              aria-label="Next result"
            >
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            </button>
          </div>
        )}

        <button
          onClick={handleClose}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
          aria-label="Close search"
        >
          <X className="h-4 w-4 text-slate-500" />
        </button>
      </div>

      {/* Search results dropdown */}
      {searchQuery && searchResults.length > 0 && (
        <div className="max-h-60 overflow-y-auto border-t border-slate-100">
          {searchResults.slice(0, 20).map((msg, idx) => {
            const timeStr = msg.createdAt?.toDate
              ? formatRelativeTime(msg.createdAt.toDate())
              : '';

            return (
              <button
                key={msg.id}
                onClick={() => {
                  setSelectedIndex(idx);
                  onSelectResult(msg.id);
                }}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors',
                  selectedIndex === idx && 'bg-blue-50',
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-900 line-clamp-2">
                    {highlightMatch(msg.body, searchQuery)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{timeStr}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
