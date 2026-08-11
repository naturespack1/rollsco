import { useEffect, useState } from 'react';
import { X, Star, MapPin, MessageSquare, ExternalLink, CheckCircle, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { Order } from '@/types';

interface OrderFeedbackModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  stores: { id: string; name: string; googleReviewUrl?: string; googleMapsUrl?: string }[];
  onFeedbackSubmitted?: (orderId: string, feedback: any) => void;
}

export default function OrderFeedbackModal({ order, isOpen, onClose, stores, onFeedbackSubmitted }: OrderFeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingFeedback, setExistingFeedback] = useState<{ rating: number; comment?: string; createdAt: string } | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  useEffect(() => {
    if (!isOpen || !order) {
      setRating(0);
      setComment('');
      setExistingFeedback(null);
      setError('');
      setSuccess(false);
      setShowFeedbackForm(false);
      return;
    }

    // If order already has feedback embedded, use it
    if (order.feedback) {
      setExistingFeedback(order.feedback as any);
      return;
    }

    // Otherwise fetch from API if token exists
    if (order.id && order.customerAccessToken) {
      setLoadingFeedback(true);
      api.get(`/feedback/order/${order.id}`, { params: { token: order.customerAccessToken } })
        .then(res => {
          if (res.data.data) {
            setExistingFeedback(res.data.data);
          } else {
            setExistingFeedback(null);
          }
        })
        .catch(() => setExistingFeedback(null))
        .finally(() => setLoadingFeedback(false));
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  // Resolve google review URL
  const storeMeta = stores.find(s => s.name === order.store?.name) || null;
  const googleReviewUrl = order.store?.googleReviewUrl || storeMeta?.googleReviewUrl || '';
  const googleMapsUrl = order.store?.googleMapsUrl || storeMeta?.googleMapsUrl || `https://www.google.com/maps/search/${encodeURIComponent(order.store?.name || "Roll's & Co.")}`;

  const finalReviewUrl = googleReviewUrl || googleMapsUrl;

  const handleGoogleRate = () => {
    if (finalReviewUrl) {
      window.open(finalReviewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSubmitFeedback = async () => {
    if (!order.customerAccessToken) {
      setError('Missing access token');
      return;
    }
    if (rating < 1 || rating > 5) {
      setError('Please select a rating from 1 to 5 stars');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/feedback', {
        orderId: order.id,
        token: order.customerAccessToken,
        rating,
        comment: comment.trim() || undefined,
      });
      const fb = res.data.data;
      setExistingFeedback(fb);
      setSuccess(true);
      setShowFeedbackForm(false);
      onFeedbackSubmitted?.(order.id, fb);
      setRating(0);
      setComment('');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to submit feedback';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-900 text-base tracking-tight flex items-center gap-2">
              {order.orderNo}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{order.paymentStatus}</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{order.store?.name} • {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} • {formatPrice(order.total)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Items */}
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <h4 className="text-[11px] font-bold tracking-widest uppercase text-gray-500 mb-2">Items • {order.items?.length}</h4>
            <div className="space-y-1.5">
              {order.items?.slice(0, 10).map((it, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-700">
                  <span>{it.itemName} <span className="text-gray-400">× {it.quantity}</span></span>
                  <span className="font-medium">{formatPrice(it.totalPrice || 0)}</span>
                </div>
              ))}
              {(order.items?.length || 0) > 10 && <div className="text-xs text-gray-400">+ {order.items.length - 10} more items</div>}
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid gap-3">
            {/* Rate on Google */}
            <div className="rounded-xl border-2 border-blue-100 bg-blue-50/60 p-4 flex gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-gray-900">Rate us on Google Maps</h4>
                <p className="text-xs text-gray-600 mt-0.5 leading-snug">Loved your order? Share your experience and help others discover Roll's & Co.</p>
                <button
                  onClick={handleGoogleRate}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
                >
                  <Star className="w-4 h-4 fill-white" /> Rate on Google <ExternalLink className="w-3.5 h-3.5" />
                </button>
                {googleReviewUrl ? (
                  <p className="mt-1.5 text-[10px] text-gray-500 text-center">Opens your store's Google review page</p>
                ) : (
                  <p className="mt-1.5 text-[10px] text-gray-500 text-center">Opens Google Maps for {order.store?.name}</p>
                )}
              </div>
            </div>

            {/* Feedback Card */}
            <div className="rounded-xl border-2 border-amber-100 bg-amber-50/50 p-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-gray-900">Share your feedback</h4>
                  <p className="text-xs text-gray-600 mt-0.5">Tell us how your order was. Your feedback helps us improve.</p>
                </div>
              </div>

              {loadingFeedback ? (
                <div className="mt-4 flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600" /></div>
              ) : existingFeedback ? (
                <div className="mt-4 rounded-xl bg-white border border-amber-200 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-bold text-sm text-gray-900">Feedback Submitted</span>
                  </div>
                  <div className="flex items-center gap-1 mt-3">
                    {[1,2,3,4,5].map(star => (
                      <Star key={star} className={`w-5 h-5 ${star <= existingFeedback.rating ? 'text-amber-500 fill-amber-500' : 'text-gray-200'}`} />
                    ))}
                    <span className="ml-2 text-sm font-semibold text-gray-700">{existingFeedback.rating}/5</span>
                  </div>
                  {existingFeedback.comment && (
                    <p className="mt-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border">{existingFeedback.comment}</p>
                  )}
                  <p className="mt-2 text-[11px] text-gray-400">Submitted on {new Date(existingFeedback.createdAt).toLocaleString()}</p>
                  <div className="mt-3 text-[11px] bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-green-800 font-medium">
                    You can't submit feedback again for this order. Thank you!
                  </div>
                </div>
              ) : showFeedbackForm ? (
                <div className="mt-4 space-y-4">
                  {/* Star Rating */}
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Your Rating *</label>
                    <div className="mt-2 flex items-center gap-1">
                      {[1,2,3,4,5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                          className="p-1"
                        >
                          <Star className={`w-8 h-8 transition ${ (hoverRating || rating) >= star ? 'text-amber-500 fill-amber-500 scale-110' : 'text-gray-300' }`} />
                        </button>
                      ))}
                      <span className="ml-2 text-sm font-bold text-gray-900">{rating ? `${rating}.0` : 'Select'}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700">Comment (optional, max 1000 chars)</label>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      maxLength={1000}
                      rows={4}
                      placeholder="How was the taste, packaging, service?"
                      className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
                    <div className="text-[11px] text-gray-400 text-right mt-1">{comment.length}/1000</div>
                  </div>

                  {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
                  {success && <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">Feedback submitted successfully!</div>}

                  <div className="flex gap-2">
                    <button onClick={() => setShowFeedbackForm(false)} className="flex-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200">Cancel</button>
                    <button
                      disabled={submitting || rating === 0}
                      onClick={handleSubmitFeedback}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Send className="w-4 h-4" />}
                      Submit Feedback
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowFeedbackForm(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition"
                >
                  <MessageSquare className="w-4 h-4" /> Give Feedback
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 text-center">
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Wrap. Bite. Repeat. • Roll's & Co.</p>
        </div>
      </div>
    </div>
  );
}
