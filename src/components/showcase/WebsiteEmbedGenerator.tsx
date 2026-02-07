import { useState } from 'react';
import { Code, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { Showcase } from '@/types';

interface WebsiteEmbedGeneratorProps {
  showcase: Showcase;
  baseUrl?: string;
}

export function WebsiteEmbedGenerator({
  showcase,
  baseUrl = typeof window !== 'undefined' ? window.location.origin : '',
}: WebsiteEmbedGeneratorProps) {
  const [copiedIframe, setCopiedIframe] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showIframePreview, setShowIframePreview] = useState(false);

  const showcaseUrl = `${baseUrl}/showcase/${showcase.slug}`;

  const iframeCode = `<iframe src="${showcaseUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px;" loading="lazy" title="${showcase.title}"></iframe>`;

  const scriptCode = `<div id="structureworks-showcase-${showcase.slug}"></div>
<script>
(function() {
  var container = document.getElementById('structureworks-showcase-${showcase.slug}');
  if (!container) return;
  var iframe = document.createElement('iframe');
  iframe.src = '${showcaseUrl}';
  iframe.width = '100%';
  iframe.height = '600';
  iframe.frameBorder = '0';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '8px';
  iframe.loading = 'lazy';
  iframe.title = '${showcase.title.replace(/'/g, "\\'")}';
  container.appendChild(iframe);
})();
</script>`;

  const handleCopyIframe = async () => {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2000);
    } catch {
      fallbackCopy(iframeCode);
      setCopiedIframe(true);
      setTimeout(() => setCopiedIframe(false), 2000);
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(scriptCode);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } catch {
      fallbackCopy(scriptCode);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="h-5 w-5 text-slate-500" />
          Website Embed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Public URL */}
        {showcase.slug && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Public URL
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="flex-1 truncate text-sm text-slate-600">
                {showcaseUrl}
              </span>
              <a
                href={showcaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-blue-500 hover:text-blue-600"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}

        {/* Iframe Embed Code */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">
              Iframe Embed
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyIframe}
              className="h-8"
            >
              {copiedIframe ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-green-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-900 p-3 overflow-x-auto">
            <pre className="text-xs text-green-400 whitespace-pre-wrap break-all font-mono">
              {iframeCode}
            </pre>
          </div>
          <p className="text-xs text-slate-500">
            Paste this code into your website HTML where you want the showcase
            to appear.
          </p>
        </div>

        {/* Script Widget Code */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">
              Script Widget
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopyScript}
              className="h-8"
            >
              {copiedScript ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-green-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-900 p-3 overflow-x-auto">
            <pre className="text-xs text-green-400 whitespace-pre-wrap break-all font-mono">
              {scriptCode}
            </pre>
          </div>
          <p className="text-xs text-slate-500">
            Alternative embed using a script tag. Place the div where you want
            the showcase and the script anywhere on the page.
          </p>
        </div>

        {/* Inline Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">
              Preview
            </label>
            <button
              type="button"
              onClick={() => setShowIframePreview((prev) => !prev)}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              {showIframePreview ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>
          {showIframePreview && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <iframe
                src={showcaseUrl}
                width="100%"
                height="400"
                frameBorder="0"
                style={{ border: 'none' }}
                title={`Preview: ${showcase.title}`}
                loading="lazy"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Fallback copy for browsers without Clipboard API
function fallbackCopy(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
