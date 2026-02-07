import { useState } from 'react';
import { X, Copy, CheckCircle, PenTool } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCreateSignatureRequest } from '@/hooks/useSignatures';

interface SignatureRequestProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SignatureRequest({ projectId, isOpen, onClose }: SignatureRequestProps) {
  const createSignature = useCreateSignatureRequest();

  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const shareLink = shareToken
    ? `${window.location.origin}/sign/${shareToken}`
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = signerName.trim();
    if (!trimmedName) {
      setError('Signer name is required');
      return;
    }

    try {
      const result = await createSignature.mutateAsync({
        projectId,
        signerName: trimmedName,
        signerEmail: signerEmail.trim() || undefined,
      });
      setShareToken(result.shareToken);
    } catch (err) {
      console.error('Failed to create signature request:', err);
      setError('Failed to create signature request. Please try again.');
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setSignerName('');
    setSignerEmail('');
    setShareToken(null);
    setCopied(false);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50">
      <div className="w-full min-h-screen bg-white md:min-h-0 md:my-8 md:max-w-lg md:rounded-xl md:shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:rounded-t-xl">
          <div className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">
              {shareToken ? 'Signature Link Ready' : 'Request Signature'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {shareToken && shareLink ? (
            /* Success state */
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-center text-sm text-slate-600">
                  Signature request created for <span className="font-medium text-slate-900">{signerName}</span>.
                  Share the link below so they can sign.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-1 truncate bg-transparent text-sm text-slate-700 outline-none"
                />
                <Button
                  type="button"
                  variant={copied ? 'secondary' : 'default'}
                  size="sm"
                  onClick={handleCopyLink}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          ) : (
            /* Form state */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Signer Name <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g., John Smith"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  error={error && !signerName.trim() ? error : undefined}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Signer Email
                </label>
                <Input
                  type="email"
                  placeholder="john@example.com (optional)"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                />
              </div>

              {error && signerName.trim() && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                isLoading={createSignature.isPending}
              >
                Create Signature Request
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
