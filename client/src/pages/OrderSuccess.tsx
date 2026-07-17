import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, ShoppingBag, Phone, MapPin, Clock, Receipt, Printer, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { Order } from '@/types';
import { openCustomerBillPrint, downloadBillHtml } from '@/components/CustomerBill';

export default function OrderSuccess() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const accessToken = searchParams.get('token');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoPrinted, setAutoPrinted] = useState(false);

  useEffect(() => {
    if (!orderId || !accessToken) {
      setError('This receipt link is invalid or has expired.');
      setLoading(false);
      return;
    }

    api.get(`/orders/status/${orderId}`, { params: { token: accessToken } })
      .then((res) => {
        setOrder(res.data.data);
        // Auto print bill after 1.5s delay (allow page to render first)
        setTimeout(() => {
          if (res.data.data?.store?.name) {
            try {
              openCustomerBillPrint(
                res.data.data,
                res.data.data.store.name,
                res.data.data.store.address || ''
              );
              setAutoPrinted(true);
            } catch (e) {
              console.error('Auto print failed:', e);
            }
          }
        }, 1500);
      })
      .catch(() => setError('Order not found'))
      .finally(() => setLoading(false));
  }, [orderId, accessToken]);

  const handlePrint = () => {
    if (!order?.store?.name) return;
    openCustomerBillPrint(order, order.store.name, order.store.address || '');
  };

  const handleDownload = () => {
    if (!order?.store?.name) return;
    downloadBillHtml(order, order.store.name, order.store.address || '');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <p className="text-red-600 mb-4">{error || 'Order not found'}</p>
        <Link to="/" className="text-brand-600 font-medium underline">Back to menu</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      {/* Success Header - Branded */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-black text-white text-[10px] font-black tracking-[0.2em] uppercase px-3 py-1 rounded-full mb-3">
          ⚡ Warning: Extremely Loaded • PAID
        </div>
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">Order Placed! 🔥</h1>
        <p className="text-sm font-bold tracking-wide text-brand-600 mt-1 uppercase">No Empty Bites. Only Loaded Rolls.</p>
        <p className="text-xs text-gray-500 mt-2">
          SMS sent to <span className="font-semibold text-gray-700">{order.customerPhone}</span> • Wrap. Bite. Repeat. 🔄
        </p>
        {autoPrinted && (
          <p className="text-xs text-green-600 mt-2 flex items-center justify-center gap-1">
            <Printer className="w-3 h-3" /> Bill auto-printed
          </p>
        )}
      </div>

      {/* Order Number Card - Branded */}
      <div className="bg-black rounded-2xl p-4 mb-4 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(230,57,70,0.3),_transparent_60%)]" />
        <div className="relative">
          <div className="text-[10px] font-black tracking-[0.2em] uppercase text-accent-400 mb-1">Order Number • We Don't Roll Small</div>
          <div className="text-3xl font-black tracking-tight">{order.orderNo}</div>
          <div className="text-[11px] text-white/60 mt-2 font-medium">
            Show this at counter • Rolls So Big, You Need Two Hands 🙌
          </div>
        </div>
      </div>

      {/* Estimated Time - PICKUP INSTRUCTION */}
      <div className="mb-4 rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 flex gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 relative">
          <Clock className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-black text-[13px] uppercase tracking-tight text-gray-900">Estimated Prep Time</h4>
            <span className="text-[10px] font-black uppercase tracking-widest bg-black text-white px-2 py-0.5 rounded-full">5-10 mins</span>
          </div>
          <p className="text-[13px] font-bold text-gray-900 mt-1 leading-snug">
            Your order will be ready in <span className="text-amber-700">5-10 minutes</span>. Please make yourself available to collect your order at the counter.
          </p>
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200">
              <MapPin className="w-3 h-3" /> {order.store?.name}
            </span>
          </div>
        </div>
      </div>

      {/* Order Details */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-gray-400" />
          Order Details
        </h3>

        <div className="space-y-3 mb-3">
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {item.itemName} <span className="text-gray-400">× {item.quantity}</span>
              </span>
              <span className="font-medium text-gray-900">{formatPrice(item.totalPrice || item.unitPrice * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-gray-100 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal (excl. tax)</span>
            <span>{formatPrice((order.total || 0) - (order.cgstAmount || 0) - (order.sgstAmount || 0))}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>CGST</span>
            <span>{formatPrice(order.cgstAmount || 0)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>SGST</span>
            <span>{formatPrice(order.sgstAmount || 0)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100 text-base">
            <span>Total (incl. GST)</span>
            <span>{formatPrice(order.total || 0)}</span>
          </div>
        </div>
      </div>

      {/* Pickup Info */}
      <div className="bg-accent-50 rounded-xl p-4 mb-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-800">
          <MapPin className="w-4 h-4 text-accent-600 shrink-0" />
          <span className="font-medium">Pickup at: {order.store?.name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-800">
          <Phone className="w-4 h-4 text-accent-600 shrink-0" />
          <span>Contact: {order.customerPhone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-800">
          <Clock className="w-4 h-4 text-accent-600 shrink-0" />
          <span>Show order number at counter when collecting</span>
        </div>
        {order.customerMessage && (
          <div className="bg-white rounded-lg p-3 border border-accent-200 mt-2">
            <div className="text-xs font-semibold text-accent-700 mb-1">Preparation Note:</div>
            <div className="text-sm text-gray-700">{order.customerMessage}</div>
          </div>
        )}
      </div>

      {/* Bill Actions */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Printer className="w-4 h-4 text-brand-600" />
          Your Bill
        </h3>
        <div className="text-xs text-gray-500 mb-3">
          {autoPrinted
            ? 'Your bill was auto-printed. You can print or download again below.'
            : 'Print or download your bill for your records.'}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition"
          >
            <Printer className="w-4 h-4" />
            Print Bill
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition"
          >
            <Download className="w-4 h-4" />
            Download Bill
          </button>
        </div>
      </div>

      {/* Loyalty CTA */}
      <div className="rounded-2xl bg-accent-500 p-4 mb-4 text-center">
        <div className="text-[10px] font-black tracking-[0.2em] uppercase text-black/60">Loyalty Habit Tagline</div>
        <div className="font-black text-xl uppercase tracking-tight text-black mt-1">Wrap. Bite. Repeat. 🔄</div>
        <p className="text-xs font-medium text-black/70 mt-1">Loved it? You know the drill. Two hands needed next time too 🙌</p>
      </div>

      {/* Order Again */}
      <div className="flex flex-col gap-3">
        <Link
          to="/"
          className="w-full py-3.5 rounded-2xl bg-black text-white font-black uppercase tracking-wide text-sm text-center hover:bg-gray-900 transition"
        >
          Order More • We Don't Roll Small
        </Link>
        <p className="text-center text-[10px] font-bold tracking-widest uppercase text-gray-400 mt-1">No Empty Bites. Only Loaded Rolls. • Warning: Extremely Loaded ⚡</p>
      </div>
    </div>
  );
}
