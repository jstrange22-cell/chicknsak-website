import { useState, useEffect, useMemo } from 'react';
import { Star, Copy, Send, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useCreateReviewRequest } from '@/hooks/useReviewRequests';
import { cn } from '@/lib/utils';
import type { ReviewPlatform } from '@/types';

interface ReviewRequestSenderProps {
  projectId: string;
  companyId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  onSent?: () => void;
}

const PLATFORMS: { value: ReviewPlatform; label: string }[] = [
  { value: 'google', label: 'Google' },
  { value: 'yelp', label: 'Yelp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'bbb', label: 'BBB' },
  { value: 'houzz', label: 'Houzz' },
];

function generateMessageTemplate(name: string, link: string): string {
  const displayName = name || '{Customer}';
  const displayLink = link || '{review link}';
  return `Hi ${displayName}, thank you for choosing us! We'd love your feedback. Please take a moment to leave us a review: ${displayLink}`;
}

export function ReviewRequestSender({
  projectId,
  companyId: _companyId,
  customerName: initialName = '',
  customerEmail: initialEmail = '',
  customerPhone: initialPhone = '',
  onSent,
}: ReviewRequestSenderProps) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [platform, setPlatform] = useState<ReviewPlatform | undefined>();
  const [reviewLink, setReviewLink] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const createReviewRequest = useCreateReviewRequest();

  // Generate initial message template
  useEffect(() => {
    setMessage(generateMessageTemplate(name, reviewLink));
  }, []); // Only on mount

  // Update message dynamically as name or link changes
  const dynamicMessage = useMemo(() => {
    // Only auto-update if the message hasn't been manually edited away from
    // the template pattern — check if it still resembles the template.
    return generateMessageTemplate(name, reviewLink);
  }, [name, reviewLink]);

  // Sync dynamic message unless user has manually edited
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);

  useEffect(() => {
    if (!isManuallyEdited) {
      setMessage(dynamicMessage);
    }
  }, [dynamicMessage, isManuallyEdited]);

  const handleMessageChange = (value: string) => {
    setMessage(value);
    setIsManuallyEdited(true);
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = message;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveDraft = () => {
    createReviewRequest.mutate(
      {
        projectId,
        customerName: name,
        customerEmail: email || undefined,
        customerPhone: phone || undefined,
        platform,
        reviewLink: reviewLink || undefined,
        message,
        status: 'draft',
      },
      {
        onSuccess: () => {
          onSent?.();
        },
      }
    );
  };

  const handleMarkAsSent = () => {
    createReviewRequest.mutate(
      {
        projectId,
        customerName: name,
        customerEmail: email || undefined,
        customerPhone: phone || undefined,
        platform,
        reviewLink: reviewLink || undefined,
        message,
        status: 'sent',
      },
      {
        onSuccess: () => {
          onSent?.();
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          Request a Review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Customer Info */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Customer Name
            </label>
            <Input
              placeholder="Customer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Email
              </label>
              <Input
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Phone
              </label>
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Platform Selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Review Platform
          </label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() =>
                  setPlatform(platform === p.value ? undefined : p.value)
                }
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  platform === p.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Review Link */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            <span className="flex items-center gap-1">
              Review Link
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </span>
          </label>
          <Input
            type="url"
            placeholder="https://g.page/r/your-business/review"
            value={reviewLink}
            onChange={(e) => setReviewLink(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            Direct link to your review page on the selected platform.
          </p>
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700">
            Message
          </label>
          <Textarea
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            rows={4}
            className="border-slate-300 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-500">
            This message updates automatically as you change the name and link
            above, unless you edit it manually.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyMessage}
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied!' : 'Copy Message'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSaveDraft}
            isLoading={
              createReviewRequest.isPending &&
              !createReviewRequest.variables?.status?.includes('sent')
            }
            disabled={!name.trim()}
          >
            Save Draft
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleMarkAsSent}
            isLoading={
              createReviewRequest.isPending &&
              createReviewRequest.variables?.status === 'sent'
            }
            disabled={!name.trim()}
          >
            <Send className="h-4 w-4" />
            Mark as Sent
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
