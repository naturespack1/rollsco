import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Store, Clock, ChevronRight, Star, CheckCircle, Printer, X, Receipt, Package, History, Flame, Zap, HandMetal } from 'lucide-react';
import { api } from '@/lib/api';
import { useStoreStore } from '@/store/useStoreStore';
import { useCartStore } from '@/store/useCartStore';
import { useCustomerOrdersStore } from '@/store/useCustomerOrdersStore';
import type { Store as StoreType } from '@/types';
import { cn, formatPrice } from '@/lib/utils';
import { downloadBillHtml } from '@/components/CustomerBill';
import BrandMarquee from '@/components/BrandMarquee';
import BrandFooter from '@/components/BrandFooter';

const heroCards = [
  { 
    image: '/images/rolls.jpg', 
    tag: 'PRIMARY',
    title: 'No Empty Bites.', 
    subtitle: 'Only Loaded Rolls.',
    badge: '🔥 Most Loved',
    color: 'from-brand-600/90 to-black/80'
  },
  { 
    image: '/images/burgers.jpg', 
    tag: 'WARNING',
    title: 'Extremely Loaded', 
    subtitle: 'Seriously overloaded',
    badge: '⚡ WARNING',
    color: 'from-black/90 to-brand-700/70'
  },
  { 
    image: '/images/combos.jpg', 
    tag: 'VIRAL',
    title: 'Two Hands Needed', 
    subtitle: 'Rolls so big, you need two hands',
    badge: '🙌 VIRAL',
    color: 'from-accent-600/80 to-black/80'
  },
];

export default function StoreSelector() {
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const setSelectedStore = useStoreStore((s) => s.setSelectedStore);
  const setStoreId = useCartStore((s) => s.setStoreId);

  const hasRecentOrder = useCustomerOrdersStore((s) => s.hasRecentOrder());
  const lastOrder = useCustomerOrdersStore((s) => s.getLastCompletedOrder());
  const markLastOrderShown = useCustomerOrdersStore((s) => s.markLastOrderShown);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    api.get('/stores').then((res) => {
      const all = (res.data.data || []) as StoreType[];
      // Open stores first, closed at last
      const sorted = [...all].sort((a, b) => {
        const aOpen = a.isOpen && a.acceptingOrders ? 0 : 1;
        const bOpen = b.isOpen && b.acceptingOrders ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
        return a.name.localeCompare(b.name);
      });
      setStores(sorted);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (hasRecentOrder && lastOrder) {
      setShowSuccess(true);
      markLastOrderShown();
      // Keep banner visible for 2 minutes to show preparation info, then auto-hide
      const timer = setTimeout(() => setShowSuccess(false), 120000);
      return () => clearTimeout(timer);
    }
  }, [hasRecentOrder, lastOrder, markLastOrderShown]);

  const selectStore = (store: StoreType) => {
    if (!store.isOpen || !store.acceptingOrders) return;
    setSelectedStore(store);
    setStoreId(store.id);
    navigate('/');
  };

  const handleDismiss = () => setShowSuccess(false);
  const handleDownloadBill = () => {
    if (!lastOrder?.store?.name) return;
    downloadBillHtml(lastOrder, lastOrder.store.name, lastOrder.store.address || '');
  };
  const handleViewReceipt = (orderId: string, accessToken?: string) => {
    if (!accessToken) return;
    navigate(`/success/${orderId}?token=${encodeURIComponent(accessToken)}`);
  };
  const handleDownloadOrderBill = (order: any) => {
    if (!order?.store?.name) return;
    downloadBillHtml(order, order.store.name, order.store.address || '');
  };
  const recentOrders = useCustomerOrdersStore((s) => s.getRecentOrders(24 * 60));

  return (
    <div className="w-full overflow-hidden">
      <BrandMarquee />

      <div className="max-w-2xl mx-auto px-4 py-5">
        {showSuccess && lastOrder && (
          <div className="mb-6 rounded-[1.75rem] bg-white border-2 border-green-500 shadow-[0_8px_30px_rgba(34,197,94,0.15)] overflow-hidden animate-in fade-in slide-in-from-top-3 duration-500">
            {/* Header */}
            <div className="bg-green-600 px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-black text-white text-[15px] uppercase tracking-tight leading-tight">Order Placed! 🔥 No Empty Bites.</h3>
                  <p className="text-[11px] text-white/80 mt-1 font-medium leading-relaxed">
                    SMS sent to <span className="font-bold text-white">{lastOrder.customerPhone}</span> • Pickup at {lastOrder.store?.name || 'Rolls & Co.'}
                  </p>
                </div>
              </div>
              <button onClick={handleDismiss} className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              {/* Order Number hero */}
              <div className="rounded-2xl bg-gray-900 p-4 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(34,197,94,0.25),_transparent_60%)]" />
                <div className="relative">
                  <div className="text-[10px] font-black tracking-[0.2em] uppercase text-accent-400">Order Number • Show at counter</div>
                  <div className="text-3xl md:text-4xl font-black tracking-tight text-white mt-1">{lastOrder.orderNo}</div>
                  <div className="text-[11px] font-bold tracking-widest uppercase text-white/50 mt-2">We Don't Roll Small • ⚡ Extremely Loaded</div>
                </div>
              </div>

              {/* Order details */}
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-brand-600" />
                  <h4 className="text-[11px] font-black tracking-[0.18em] uppercase text-gray-900">Order Details • {lastOrder.items?.length || 0} items</h4>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
                  {lastOrder.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600 shrink-0">{item.quantity}</span>
                        <span className="text-gray-800 font-medium truncate">{item.itemName}</span>
                      </div>
                      <span className="font-bold text-gray-900">{formatPrice(item.totalPrice || (item.unitPrice * item.quantity))}</span>
                    </div>
                  ))}
                  <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-sm font-black uppercase tracking-wide text-gray-900">Total Paid (incl. GST)</span>
                    <span className="text-base font-black text-gray-900">{formatPrice(lastOrder.total)}</span>
                  </div>
                </div>
              </div>

              {/* Estimated prep time - THE MAIN REQUEST */}
              <div className="mt-4 rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 flex gap-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-amber-100 rounded-full blur-2xl opacity-60" />
                <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 relative">
                  <Clock className="w-6 h-6 text-white" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" />
                </div>
                <div className="flex-1 min-w-0 relative">
                  <div className="flex items-center gap-2">
                    <h4 className="font-black text-[13px] uppercase tracking-tight text-gray-900">Estimated Preparation Time</h4>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-black text-white px-2 py-0.5 rounded-full">5-10 mins</span>
                  </div>
                  <p className="text-[13px] font-bold text-gray-900 mt-1 leading-snug">
                    Your order will be ready in <span className="text-amber-600">5-10 minutes</span>. Please make yourself available to collect your order at the counter.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
                      <MapPin className="w-3 h-3" /> {lastOrder.store?.name || 'Rolls & Co.'}
                    </span>
                    <span className="text-[10px] font-medium text-gray-600">Show <span className="font-black text-gray-900">{lastOrder.orderNo}</span> at pickup</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <button onClick={handleDownloadBill} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-green-600 text-white text-xs font-black uppercase tracking-wide hover:bg-green-700 transition">
                  <Printer className="w-4 h-4" /> Download Bill
                </button>
                <button onClick={() => lastOrder && handleViewReceipt(lastOrder.id, lastOrder.customerAccessToken)} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-gray-900 text-white text-xs font-black uppercase tracking-wide hover:bg-black transition">
                  <Receipt className="w-4 h-4" /> View Receipt
                </button>
              </div>

              <div className="mt-3 text-center">
                <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400">🔄 Wrap. Bite. Repeat. • Rolls So Big, You Need Two Hands 🙌</p>
              </div>
            </div>
          </div>
        )}

        {/* HERO - PRIMARY TAGLINE LOCKED */}
        <div className="relative rounded-[2rem] overflow-hidden bg-gray-900 p-6 md:p-8 mb-5">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(230,57,70,0.4),_transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,_rgba(255,195,0,0.2),_transparent_40%)]" />
          </div>
          
          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-accent-500 text-black text-[10px] font-black tracking-[0.18em] uppercase px-3 py-1 rounded-full mb-4">
              <Flame className="w-3.5 h-3.5" /> WE DON'T ROLL SMALL • SECONDARY TAGLINE
            </div>

            <h1 className="font-black tracking-tight leading-[0.9] text-[2.2rem] md:text-[2.8rem]">
              <span className="text-white block">No Empty Bites.</span>
              <span className="text-brand-500 block">Only Loaded Rolls.</span>
            </h1>

            <p className="text-white/60 text-sm mt-3 leading-relaxed max-w-[90%] font-medium">
              Solves a real street-food doubt. Every bite is overloaded till the last wrap. That's our promise.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 bg-white text-black rounded-full px-3 py-1.5 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-black" /> 4.8 • 2.3k+ reviews
              </div>
              <div className="flex items-center gap-1.5 bg-white/10 border border-white/10 text-white rounded-full px-3 py-1.5 text-xs font-bold">
                <Zap className="w-3.5 h-3.5 text-accent-400" /> Warning: Extremely Loaded
              </div>
            </div>
          </div>
        </div>

        {/* HERO IMAGE GRID WITH TAGLINE OVERLAYS */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {heroCards.map((t, idx) => (
            <div key={idx} className="relative rounded-2xl overflow-hidden aspect-[4/5.2] bg-gray-100 shadow-sm group">
              <img src={t.image} alt={t.title} className="w-full h-full object-cover transition duration-700 group-hover:scale-110" loading="eager" />
              <div className={`absolute inset-0 bg-gradient-to-t ${t.color}`} />
              <div className="absolute top-2 left-2">
                <span className="text-[8px] font-black tracking-widest uppercase bg-white text-black px-2 py-0.5 rounded-full">
                  {t.badge}
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                <p className="text-white font-black text-[12px] leading-[1.1] tracking-tight uppercase">{t.title}</p>
                <p className="text-white/70 text-[10px] leading-tight font-medium mt-0.5">{t.subtitle}</p>
              </div>
            </div>
          ))}
        </div>

        {/* VIRAL HOOK STRIP */}
        <div className="rounded-2xl bg-accent-50 border border-accent-200 p-4 mb-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
            <HandMetal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-tight text-gray-900">Rolls So Big, You Need Two Hands 🎬</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Launch campaign. Perfect for reels, blackboard, flyers. Tag us & get featured. <span className="font-bold text-brand-600">#TwoHandsNeeded</span>
            </p>
            <div className="mt-2 flex gap-1.5">
              <span className="text-[10px] font-bold bg-black text-white px-2 py-1 rounded-full">#ExtremelyLoaded</span>
              <span className="text-[10px] font-bold bg-brand-600 text-white px-2 py-1 rounded-full">#NoEmptyBites</span>
              <span className="text-[10px] font-bold bg-white border border-gray-200 text-gray-700 px-2 py-1 rounded-full">UGC Ready</span>
            </div>
          </div>
        </div>

        {/* STORE SELECTION WITH TAGLINE */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black tracking-tight text-gray-900 uppercase">Select Store</h2>
            <p className="text-[11px] font-bold tracking-widest uppercase text-brand-600 -mt-0.5">We Don't Roll Small → Only Loaded Locations</p>
          </div>
          <div className="text-[9px] font-black tracking-widest uppercase bg-gray-900 text-white px-2 py-1 rounded-full">Pickup Only</div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : (
          <div className="grid gap-3">
            {stores.map((store) => (
              <button
                key={store.id}
                onClick={() => selectStore(store)}
                disabled={!store.isOpen || !store.acceptingOrders}
                className={cn(
                  'relative flex items-start gap-4 p-4 rounded-2xl border text-left transition text-left group',
                  store.isOpen && store.acceptingOrders
                    ? 'bg-white border-gray-200 shadow-sm hover:border-brand-300 hover:shadow-md active:scale-[0.99]'
                    : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                )}
              >
                <div className="mt-1 w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-600 group-hover:text-white transition">
                  <Store className="w-5 h-5 text-brand-600 group-hover:text-white transition" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 truncate text-sm">{store.name}</h3>
                    {store.isOpen && store.acceptingOrders ? (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                        <Clock className="w-3 h-3" /> Open • Loaded
                      </span>
                    ) : (
                      <span className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-50 px-2.5 py-1 rounded-full">Closed</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{store.address}</span>
                  </div>
                  <div className="mt-2 text-[10px] font-bold tracking-widest uppercase text-gray-400 flex items-center gap-2">
                    <span>⚡ Warning: Extremely Loaded in this store</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 self-center group-hover:text-brand-600" />
              </button>
            ))}
          </div>
        )}

        {/* TRUST SECTION - TAGLINE GRID */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gray-900 text-white p-4">
            <div className="text-[10px] font-black tracking-widest uppercase text-accent-400 mb-1">Packaging / Sticker</div>
            <div className="font-black text-sm uppercase leading-tight">Warning:<br/>Extremely Loaded ⚡</div>
            <p className="text-[11px] text-white/50 mt-2 leading-relaxed">Edgy, Gen-Z. Works on cups, bags, reel overlay.</p>
          </div>
          <div className="rounded-2xl bg-brand-600 text-white p-4">
            <div className="text-[10px] font-black tracking-widest uppercase text-white/60 mb-1">Loyalty / Habit</div>
            <div className="font-black text-sm uppercase leading-tight">Wrap.<br/>Bite. Repeat. 🔄</div>
            <p className="text-[11px] text-white/70 mt-2 leading-relaxed">Best for stamp cards, receipt footer, WhatsApp.</p>
          </div>
        </div>

        {/* RECENT ORDERS */}
        {recentOrders.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-brand-600" />
              <h2 className="text-[13px] font-black tracking-widest uppercase text-gray-900">Your Orders • Wrap. Bite. Repeat.</h2>
            </div>
            <div className="grid gap-3">
              {recentOrders.map((order) => {
                const isFresh = (Date.now() - new Date(order.createdAt).getTime()) < 15 * 60 * 1000;
                return (
                <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-brand-600" />
                      <span className="font-bold text-gray-900">{order.orderNo}</span>
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', order.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : order.paymentStatus === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>{order.paymentStatus}</span>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-3">{order.store?.name || 'Rolls & Co.'}</div>
                  <div className="space-y-1.5 mb-3">
                    {order.items?.slice(0, 3).map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm text-gray-700"><span>{item.itemName} <span className="text-gray-400">× {item.quantity}</span></span><span className="font-medium text-gray-900">{formatPrice(item.totalPrice || item.unitPrice * item.quantity)}</span></div>
                    ))}
                    {order.items?.length > 3 && <div className="text-xs text-gray-400">+ {order.items.length - 3} more items</div>}
                  </div>

                  {isFresh && order.paymentStatus === 'PAID' && (
                    <div className="mb-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 flex gap-2 items-start">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold leading-relaxed text-amber-900">
                        Estimated time: <span className="text-amber-700">5-10 mins</span>. Please be available at counter to collect • Show {order.orderNo}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="text-sm font-bold text-gray-900">Total: {formatPrice(order.total)}</div>
                    <div className="flex gap-2">
                      <button onClick={() => handleDownloadOrderBill(order)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 text-xs font-medium hover:bg-brand-100 transition"><Printer className="w-3.5 h-3.5" /> Bill</button>
                      <button onClick={() => handleViewReceipt(order.id, order.customerAccessToken)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200 transition"><Receipt className="w-3.5 h-3.5" /> Receipt</button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto">
        <BrandFooter />
      </div>
    </div>
  );
}
