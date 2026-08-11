import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Star, MessageSquare, Calendar, User, Phone, ShoppingBag, TrendingUp } from 'lucide-react';

interface AdminFeedbacksProps {
  storeId: string;
}

interface FeedbackItem {
  id: string;
  orderId: string;
  orderNo: string;
  rating: number;
  comment?: string;
  createdAt: string;
  customerPhone?: string;
  customerName?: string;
  orderTotal?: number;
  storeId: string;
  store: { name: string };
  // Legacy nested for backward compat if exists
  order?: {
    orderNo: string;
    customerPhone: string;
    customerName?: string;
    total: number;
    paymentMethod?: string;
    createdAt: string;
  };
}

export default function AdminFeedbacks({ storeId }: AdminFeedbacksProps) {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [average, setAverage] = useState(0);
  const [distribution, setDistribution] = useState<Record<number, number>>({ 1:0,2:0,3:0,4:0,5:0 });
  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<number | ''>('');
  const [daysFilter, setDaysFilter] = useState(30);
  const [currentStoreId, setCurrentStoreId] = useState(storeId);

  const limit = 20;

  // Track store change – reset and reload
  useEffect(() => {
    if (storeId !== currentStoreId) {
      setCurrentStoreId(storeId);
      setPage(1);
      setFeedbacks([]);
      setTotal(0);
      setLoading(true);
    }
  }, [storeId, currentStoreId]);

  const loadFeedbacks = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await api.get('/admin/feedbacks', {
        params: {
          storeId,
          page,
          limit,
          rating: ratingFilter || undefined,
        },
      });
      const data = res.data.data;
      setFeedbacks(data.feedbacks || []);
      setTotal(data.total || 0);
      setAverage(data.average || 0);
      setDistribution(data.distribution || {1:0,2:0,3:0,4:0,5:0});
    } catch (err) {
      console.error('Failed to load feedbacks', err);
    } finally {
      setLoading(false);
    }
  }, [storeId, page, ratingFilter]);

  const loadStats = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await api.get('/admin/feedbacks/stats', { params: { storeId, days: daysFilter } });
      const data = res.data.data;
      if (daysFilter !== 0) {
        // if days filter not all time, stats reflect filtered avg, but we keep feedbacks avg separately?
        // For simplicity, average already from feedbacks endpoint; stats endpoint can still update if needed.
      }
      setAverage(data.average || average);
    } catch {}
  }, [storeId, daysFilter]);

  useEffect(() => {
    setPage(1);
  }, [storeId, ratingFilter, daysFilter]);

  useEffect(() => {
    loadFeedbacks();
  }, [loadFeedbacks]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Also reload whenever storeId changes even if page is already 1
  useEffect(() => {
    if (storeId) {
      loadFeedbacks();
    }
  }, [storeId]);

  const totalFeedbacks = Object.values(distribution).reduce((a,b) => a+b, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-400" /> Customer Feedbacks
            <span className="ml-2 text-[10px] bg-gray-800 border border-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{storeId.slice(0,8)}... • {currentStoreId === storeId ? 'synced' : 'switching'}</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">Feedback submitted by customers for their orders – no foreign key to orders table, easy cleanup. Showing for selected store only.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={daysFilter} onChange={e => setDaysFilter(Number(e.target.value))} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200">
            <option value={0}>All Time</option>
            <option value={1}>Last 24 Hours</option>
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
          <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value ? Number(e.target.value) : '')} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200">
            <option value="">All Ratings</option>
            <option value={5}>5 Stars</option>
            <option value={4}>4 Stars</option>
            <option value={3}>3 Stars</option>
            <option value={2}>2 Stars</option>
            <option value={1}>1 Star</option>
          </select>
          <button onClick={() => { setPage(1); loadFeedbacks(); }} className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700">Refresh</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase font-semibold tracking-widest"><TrendingUp className="w-4 h-4 text-amber-400" /> Average Rating</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-3xl font-bold text-white">{average ? average.toFixed(1) : '0.0'}</span>
            <div className="flex items-center gap-0.5 pb-1">
              {[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= Math.round(average) ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />)}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">{total} total feedbacks for this store</p>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="text-xs text-gray-400 uppercase font-semibold tracking-widest flex items-center gap-2"><Star className="w-4 h-4 text-green-400" /> Distribution</div>
          <div className="mt-3 space-y-1.5">
            {[5,4,3,2,1].map(star => {
              const count = distribution[star] || 0;
              const pct = totalFeedbacks ? (count / totalFeedbacks) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-6 text-gray-300">{star}★</span>
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-gray-400">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <div className="text-xs text-gray-400 uppercase font-semibold tracking-widest">Insights</div>
          <div className="mt-3 space-y-2 text-xs text-gray-300">
            <div className="flex justify-between"><span>5★ Positive</span><span className="font-bold text-green-400">{distribution[5] || 0}</span></div>
            <div className="flex justify-between"><span>1★ Critical</span><span className="font-bold text-red-400">{distribution[1] || 0}</span></div>
            <div className="flex justify-between"><span>Total Reviews</span><span className="font-bold text-white">{totalFeedbacks}</span></div>
            <div className="pt-2 border-t border-gray-700 text-[11px] text-gray-500">Feedback stored without FK to Order table for easy cleanup. Order deletion doesn't block.</div>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-20 bg-gray-800 rounded-xl border border-gray-700">
          <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-semibold">No feedbacks found for this store</p>
          <p className="text-xs text-gray-500 mt-1">Switch store selector above – data changes per store. When customers rate orders from 24h history, feedbacks will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map(fb => {
            const orderNo = fb.orderNo || fb.order?.orderNo || fb.orderId.slice(0,8);
            const custPhone = fb.customerPhone || fb.order?.customerPhone || '—';
            const custName = fb.customerName || fb.order?.customerName || 'Guest';
            const totalAmt = (fb as any).orderTotal || fb.order?.total || 0;
            const createdAt = fb.createdAt;
            return (
              <div key={fb.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">{orderNo}</span>
                    <span className="flex items-center gap-1">
                      {[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-600'}`} />)}
                      <span className="ml-1 text-xs font-bold text-amber-300">{fb.rating}/5</span>
                    </span>
                    <span className="text-xs text-gray-500">{new Date(createdAt).toLocaleString('en-IN')}</span>
                  </div>
                  {fb.comment ? (
                    <div className="mt-3 bg-gray-900 rounded-lg p-3 border border-gray-700 text-sm text-gray-200 leading-relaxed">
                      "{fb.comment}"
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-gray-500 italic">No comment provided</p>
                  )}
                  <div className="mt-3 flex items-center gap-4 flex-wrap text-xs text-gray-400">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {custName}</span>
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {custPhone}</span>
                    {totalAmt ? <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {formatPrice(totalAmt)}</span> : null}
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col gap-2 md:w-40">
                  <div className="text-xs text-gray-500">Store: <span className="text-gray-200 font-medium">{fb.store.name}</span></div>
                  <div className={`px-3 py-1.5 rounded-full text-center text-xs font-bold border ${
                    fb.rating >=4 ? 'bg-green-900/30 text-green-300 border-green-800' :
                    fb.rating >=3 ? 'bg-amber-900/30 text-amber-300 border-amber-800' :
                    'bg-red-900/30 text-red-300 border-red-800'
                  }`}>
                    {fb.rating >=4 ? 'Positive' : fb.rating >=3 ? 'Neutral' : 'Critical'}
                  </div>
                  <div className="text-[10px] text-gray-500">ID: {fb.orderId.slice(0,8)}… no FK</div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-4">
            <p className="text-xs text-gray-400">Page {page} • {total} feedbacks • Store {storeId.slice(0,6)}</p>
            <div className="flex gap-2">
              <button disabled={page<=1} onClick={()=> setPage(p=> Math.max(1,p-1))} className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-white disabled:opacity-40">Prev</button>
              <button disabled={feedbacks.length < limit} onClick={()=> setPage(p=> p+1)} className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-xs text-white disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
