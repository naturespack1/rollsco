import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Store, Clock, ChevronRight, Star, CheckCircle, Printer, X, Receipt, Package, History } from 'lucide-react';
import { api } from '@/lib/api';
import { useStoreStore } from '@/store/useStoreStore';
import { useCartStore } from '@/store/useCartStore';
import { useCustomerOrdersStore } from '@/store/useCustomerOrdersStore';
import type { Store as StoreType } from '@/types';
import { cn, formatPrice } from '@/lib/utils';
import { downloadBillHtml } from '@/components/CustomerBill';

const taglines = [
  { image: '/images/rolls.jpg', text: 'Rolls that roll your taste buds', sub: 'Fresh parathas, spicy fillings' },
  { image: '/images/burgers.jpg', text: 'Burgers built for cravings', sub: 'Juicy patties, melted cheese' },
  { image: '/images/combos.jpg', text: 'Combos that save more', sub: 'Best value meals, always hot' },
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
    <div className="max-w-2xl mx-auto px-4 py-6">
      {showSuccess && lastOrder && (
        <div className="mb-6 rounded-2xl bg-white border-2 border-green-500 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="bg-green-600 px-5 py-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-white text-[15px] tracking-tight">Order Placed!</h3>
                <p className="text-[11px] text-white/80 mt-1">
                  SMS sent to <span className="font-bold text-white">{lastOrder.customerPhone}</span> • Pickup at {lastOrder.store?.name || "Roll's & Co." }
                </p>
              </div>
            </div>
            <button onClick={handleDismiss} className="p-1.5 rounded-full bg-white/20 text-white hover:bg-white/30 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5">
            <div className="rounded-xl bg-gray-900 p-4 text-center">
              <div className="text-[10px] font-bold tracking-widest uppercase text-white/50">Order Number • Show at counter</div>
              <div className="text-3xl font-bold tracking-tight text-white mt-1">{lastOrder.orderNo}</div>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-brand-600" />
                <h4 className="text-[11px] font-bold tracking-widest uppercase text-gray-900">Order Details • {lastOrder.items?.length || 0} items</h4>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
                {lastOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.itemName} <span className="text-gray-400">× {item.quantity}</span></span>
                    <span className="font-semibold text-gray-900">{formatPrice(item.totalPrice || item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between font-bold">
                  <span>Total (incl. GST)</span>
                  <span>{formatPrice(lastOrder.total)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-300 p-4 flex gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-[13px] text-gray-900">Estimated Preparation Time</h4>
                  <span className="text-[10px] font-bold bg-black text-white px-2 py-0.5 rounded-full">5-10 mins</span>
                </div>
                <p className="text-[13px] text-gray-800 mt-1 leading-snug">
                  Your order will be ready in <span className="font-bold text-amber-700">5-10 minutes</span>. Please make yourself available to collect your order.
                </p>
                <p className="text-[11px] text-gray-600 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {lastOrder.store?.name || "Roll's & Co." } • Show {lastOrder.orderNo} at counter
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={handleDownloadBill} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition">
                <Printer className="w-3.5 h-3.5" /> Download Bill
              </button>
              <button onClick={() => lastOrder && handleViewReceipt(lastOrder.id, lastOrder.customerAccessToken)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-black transition">
                <Receipt className="w-3.5 h-3.5" /> View Receipt
              </button>
            </div>
            <p className="mt-3 text-center text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400">Wrap. Bite. Repeat.</p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
            Roll's & Co. <span className="text-brand-600">Pickup</span>
          </h1>
          <p className="text-[15px] font-bold tracking-tight text-brand-600">No Empty Bites. Only Loaded Rolls.</p>
          <p className="text-gray-500 text-xs mt-1">Fresh food. Fast pickup. Zero wait.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {taglines.map((t, idx) => (
            <div key={idx} className="relative rounded-xl overflow-hidden aspect-[4/5] bg-gray-100 shadow-sm group">
              <img src={t.image} alt={t.text} className="w-full h-full object-cover transition duration-500 group-hover:scale-105" loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white font-bold text-xs leading-tight mb-0.5">{t.text}</p>
                <p className="text-white/70 text-[10px] leading-tight">{t.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-1 text-xs text-gray-500">
          <Star className="w-3 h-3 text-accent-500 fill-accent-500" />
          <span>4.8 rating · 15 min avg prep · No delivery fees</span>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Select Store</h2>
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
                'relative flex items-start gap-4 p-4 rounded-xl border text-left transition',
                store.isOpen && store.acceptingOrders
                  ? 'bg-white border-gray-200 shadow-sm hover:border-brand-300 hover:shadow-md active:scale-[0.99]'
                  : 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
              )}
            >
              <div className="mt-1">
                <Store className="w-8 h-8 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 truncate">{store.name}</h3>
                  {store.isOpen && store.acceptingOrders ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" /> Open
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      Closed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{store.address}</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 self-center" />
            </button>
          ))}
        </div>
      )}

      {recentOrders.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-gray-900">Your Orders (Last 24 Hours)</h2>
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

                <div className="text-xs text-gray-500 mb-3">{order.store?.name || "Roll's & Co." }</div>

                <div className="space-y-1.5 mb-3">
                  {order.items?.slice(0, 3).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm text-gray-700">
                      <span>{item.itemName} <span className="text-gray-400">× {item.quantity}</span></span>
                      <span className="font-medium text-gray-900">{formatPrice(item.totalPrice || item.unitPrice * item.quantity)}</span>
                    </div>
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

      <div className="mt-10 text-center">
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-400">Wrap. Bite. Repeat.</p>
      </div>
    </div>
  );
}
