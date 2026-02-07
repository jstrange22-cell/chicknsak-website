import { useState, useEffect, useMemo } from 'react';
import {
  Star,
  Plus,
  X,
  Send,
  Loader2,
  Search,
  Mail,
  Phone,
  ExternalLink,
  MessageSquare,
  CheckCircle2,
  MousePointerClick,
  FileEdit,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { ReviewRequest, ReviewRequestStatus, ReviewPlatform } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<ReviewRequestStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: FileEdit },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  clicked: { label: 'Clicked', color: 'bg-amber-100 text-amber-700', icon: MousePointerClick },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
};

const PLATFORM_CONFIG: Record<ReviewPlatform, { label: string; color: string }> = {
  google: { label: 'Google', color: 'bg-red-50 text-red-600 border-red-200' },
  yelp: { label: 'Yelp', color: 'bg-rose-50 text-rose-600 border-rose-200' },
  facebook: { label: 'Facebook', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  bbb: { label: 'BBB', color: 'bg-sky-50 text-sky-600 border-sky-200' },
  houzz: { label: 'Houzz', color: 'bg-green-50 text-green-600 border-green-200' },
};

const PLATFORMS: { value: ReviewPlatform; label: string }[] = [
  { value: 'google', label: 'Google' },
  { value: 'yelp', label: 'Yelp' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'bbb', label: 'BBB' },
  { value: 'houzz', label: 'Houzz' },
];

// ---------------------------------------------------------------------------
// Create Review Request Modal
// ---------------------------------------------------------------------------

interface CreateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (review: ReviewRequest) => void;
  companyId: string;
  userId: string;
}

function CreateReviewModal({ isOpen, onClose, onCreated, companyId, userId }: CreateReviewModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [platform, setPlatform] = useState<ReviewPlatform>('google');
  const [reviewLink, setReviewLink] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setPlatform('google');
    setReviewLink('');
    setMessage('');
    setError(null);
  };

  const handleSubmit = async (sendImmediately: boolean) => {
    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const newStatus: ReviewRequestStatus = sendImmediately ? 'sent' : 'draft';
      const data: Record<string, unknown> = {
        companyId,
        projectId: '',
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        platform,
        reviewLink: reviewLink.trim() || undefined,
        message: message.trim() || undefined,
        status: newStatus,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(sendImmediately ? { sentAt: serverTimestamp() } : {}),
      };

      const docRef = await addDoc(collection(db, 'reviewRequests'), data);
      const created = { id: docRef.id, ...data } as unknown as ReviewRequest;
      onCreated(created);
      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to create review request:', err);
      setError('Failed to create review request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Request Review</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
          {/* Customer Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="John Smith"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Platform */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as ReviewPlatform)}
              className="flex h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Review Link */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Review Link URL</label>
            <Input
              type="url"
              placeholder="https://g.page/r/your-business/review"
              value={reviewLink}
              onChange={(e) => setReviewLink(e.target.value)}
            />
          </div>

          {/* Custom Message */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Custom Message</label>
            <textarea
              placeholder="Thank you for choosing us! We would appreciate it if you could take a moment to share your experience..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit(false)}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            <Send className="h-4 w-4" />
            Send Request
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ReviewsPage() {
  const { profile, user } = useAuthContext();

  // Data
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewRequestStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<ReviewPlatform | 'all'>('all');
  const [sendingId, setSendingId] = useState<string | null>(null);

  // ------ Load reviews from Firestore ------
  useEffect(() => {
    if (!profile?.companyId) return;

    let cancelled = false;

    async function fetchReviews() {
      setIsLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, 'reviewRequests'),
          where('companyId', '==', profile!.companyId),
        );
        const snapshot = await getDocs(q);
        if (cancelled) return;
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ReviewRequest));
        data.sort((a, b) => {
          const aTime = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
          const bTime = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
          return bTime - aTime;
        });
        setReviews(data);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load reviews:', err);
        setError('Failed to load review requests. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchReviews();
    return () => { cancelled = true; };
  }, [profile?.companyId]);

  // ------ Stats ------
  const stats = useMemo(() => {
    const total = reviews.length;
    const sent = reviews.filter((r) => r.status === 'sent' || r.status === 'clicked' || r.status === 'completed').length;
    const completed = reviews.filter((r) => r.status === 'completed').length;
    const completionRate = sent > 0 ? Math.round((completed / sent) * 100) : 0;
    return { total, sent, completed, completionRate };
  }, [reviews]);

  // ------ Filtered reviews ------
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (platformFilter !== 'all' && r.platform !== platformFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.customerName.toLowerCase().includes(q);
        const matchesEmail = r.customerEmail?.toLowerCase().includes(q);
        const matchesPhone = r.customerPhone?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }
      return true;
    });
  }, [reviews, statusFilter, platformFilter, searchQuery]);

  // ------ Handlers ------
  const handleCreated = (review: ReviewRequest) => {
    setReviews((prev) => [review, ...prev]);
  };

  const handleSend = async (reviewId: string) => {
    setSendingId(reviewId);
    try {
      await updateDoc(doc(db, 'reviewRequests', reviewId), {
        status: 'sent',
        sentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId ? { ...r, status: 'sent' as ReviewRequestStatus } : r
        )
      );
    } catch (err) {
      console.error('Failed to send review request:', err);
    } finally {
      setSendingId(null);
    }
  };

  // ------ Render ------
  return (
    <div className="flex flex-col min-h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-1">Reviews</h1>
          <p className="text-slate-500 text-sm">
            Gather feedback and manage customer reviews in one place.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          Request Review
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                <MessageSquare className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Total</p>
                <p className="text-xl font-bold text-slate-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Sent</p>
                <p className="text-xl font-bold text-slate-900">{stats.sent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Completed</p>
                <p className="text-xl font-bold text-slate-900">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                <Star className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Rate</p>
                <p className="text-xl font-bold text-slate-900">{stats.completionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          />
        </div>
        <div className="flex gap-3 flex-shrink-0">
          {/* Status filter */}
          <div className="flex gap-1.5">
            {(['all', 'draft', 'sent', 'clicked', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                  statusFilter === s
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {/* Platform filter */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value as ReviewPlatform | 'all')}
            className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg border border-slate-200 py-20">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg border border-slate-200 py-20">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Star className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {reviews.length > 0 ? 'No matching reviews' : 'No review requests yet'}
          </h3>
          <p className="text-sm text-slate-500 max-w-[280px] text-center leading-relaxed">
            {reviews.length > 0
              ? 'Try adjusting your search or filters.'
              : 'Send your first review request to start collecting feedback.'}
          </p>
          {reviews.length === 0 && (
            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" />
              Request Review
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReviews.map((review) => {
                  const statusCfg = STATUS_CONFIG[review.status];
                  const platformCfg = review.platform ? PLATFORM_CONFIG[review.platform] : null;
                  const StatusIcon = statusCfg.icon;
                  const createdDate = review.createdAt?.toDate
                    ? review.createdAt.toDate().toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '--';
                  const sentDate = review.sentAt?.toDate
                    ? review.sentAt.toDate().toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : null;

                  return (
                    <tr key={review.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{review.customerName}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {review.customerEmail && (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Mail className="h-3 w-3" />
                                {review.customerEmail}
                              </span>
                            )}
                            {review.customerPhone && (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Phone className="h-3 w-3" />
                                {review.customerPhone}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {platformCfg ? (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
                              platformCfg.color
                            )}
                          >
                            {platformCfg.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                            statusCfg.color
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-slate-500">{createdDate}</p>
                          {sentDate && (
                            <p className="text-xs text-slate-400">Sent {sentDate}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {review.status === 'draft' && (
                            <button
                              onClick={() => handleSend(review.id)}
                              disabled={sendingId === review.id}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                              title="Send review request"
                            >
                              {sendingId === review.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          {review.reviewLink && (
                            <a
                              href={review.reviewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                              title="Open review link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <CreateReviewModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
        companyId={profile?.companyId || ''}
        userId={user?.uid || ''}
      />
    </div>
  );
}
