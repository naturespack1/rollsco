import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle, ShoppingBag, Phone, MapPin, Clock, Receipt, Printer, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import type { Order } from '@/types';
import { openCustomerBillPrint, downloadBillHtml } from '@/components/CustomerBill';

export default function OrderSuccess() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoPrinted, setAutoPrinted] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    api.get(`/orders/status/${orderId}`)
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
  }, [orderId]);

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
      {/* Success Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Order Placed!</h1>
        <p className="text-sm text-gray-500 mt-1">
          An SMS has been sent to <span className="font-semibold text-gray-700">{order.customerPhone}</span>
        </p>
        {autoPrinted && (
          <p className="text-xs text-green-600 mt-2 flex items-center justify-center gap-1">
            <Printer className="w-3 h-3" /> Bill auto-printed
          </p>
        )}
      </div>

      {/* Order Number Card */}
      <div className="bg-brand-600 rounded-xl p-4 mb-4 text-white text-center">
        <div className="text-xs text-white/80 uppercase tracking-wider mb-1">Order Number</div>
        <div className="text-3xl font-bold tracking-tight">{order.orderNo}</div>
        <div className="text-xs text-white/70 mt-2">
          Show this at the counter to collect your order
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

      {/* Order Again */}
      <div className="flex flex-col gap-3">
        <Link
          to="/"
          className="w-full py-2.5 rounded-lg bg-brand-600 text-white font-semibold text-sm text-center hover:bg-brand-700 transition"
        >
          Order More
        </Link>
      </div>
    </div>
  );
}
