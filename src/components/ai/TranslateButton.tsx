import { useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { translateText, type TranslationLanguage } from '@/lib/ai/translator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TranslateButtonProps {
  text: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TranslateButton({ text, className }: TranslateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    // If we already have a translation, just toggle visibility
    if (translatedText) {
      setShowTranslation((prev) => !prev);
      return;
    }

    // Otherwise, fetch the translation
    setIsLoading(true);
    setError(null);

    try {
      const targetLang: TranslationLanguage = 'es';
      const result = await translateText(text, targetLang);
      setTranslatedText(result);
      setShowTranslation(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('inline-flex flex-col', className)}>
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        disabled={isLoading || !text.trim()}
        className="h-8 gap-1.5 px-2 text-xs text-slate-500 hover:text-slate-700"
        aria-label={showTranslation ? 'Show original' : 'Translate'}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Globe className="h-3.5 w-3.5" />
        )}
        {showTranslation ? 'Original' : 'Translate'}
      </Button>

      {/* Translated text */}
      {showTranslation && translatedText && (
        <div className="mt-1 rounded-md bg-blue-50 px-3 py-2">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-400">
            Translated
          </p>
          <p className="text-sm text-blue-900">{translatedText}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
