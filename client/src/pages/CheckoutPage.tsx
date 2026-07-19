import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, User, MessageSquare, ShieldCheck, AlertCircle } from 'lucide-react';
import { useCartStore } from '@/store/useCartStore';
import { useStoreStore } from '@/store/useStoreStore';
import { useCustomerOrdersStore } from '@/store/useCustomerOrdersStore';
import { api } from '@/lib/api';
import { openRazorpayCheckout } from '@/lib/razorpay';
import { formatPrice, formatPhone } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { downloadBillHtml } from '@/components/CustomerBill';

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const getOrCreateCheckoutIdempotencyKey = useCartStore((s) => s.getOrCreateCheckoutIdempotencyKey);
  const totals = useCartStore((s) => s.getTotals());
  const selectedStore = useStoreStore((s) => s.selectedStore);
  const clearStore = useStoreStore((s) => s.clearStore);

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle PhonePe redirect return (poll for payment status)
  useEffect(() => {
    const gateway = searchParams.get('gateway');
    const orderId = searchParams.get('orderId');
    const token = searchParams.get('token');
    if (gateway === 'phonepe' && orderId && token) {
      setLoading(true);
      setError('');
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await api.get(`/orders/status/${orderId}`, { params: { token } });
          const order = statusRes.data.data;
          if (order?.paymentStatus === 'PAID') {
            clearInterval(pollInterval);
            clearCart();
            useCustomerOrdersStore.getState().addOrder(order);
            if (order.store?.name) downloadBillHtml(order, order.store.name, order.store.address || '');
            clearStore();
            navigate('/');
          } else if (order?.paymentStatus === 'FAILED') {
            clearInterval(pollInterval);
            setError('Payment failed. Please try again or contact support.');
            setLoading(false);
          }
        } catch (err: any) {
          // Continue polling silently
        }
      }, 3000);
      // Stop polling after 5 minutes
      const timeout = setTimeout(() => {
        clearInterval(pollInterval);
        setError('Payment confirmation is taking longer than expected. Please check your SMS or contact support.');
        setLoading(false);
      }, 5 * 60 * 1000);
      return () => {
        clearInterval(pollInterval);
        clearTimeout(timeout);
      };
    }
  }, [searchParams, navigate, clearCart, clearStore]);

  const canCheckout = phone.length >= 10 && items.length > 0 && selectedStore && !loading;

  const handleCheckout = async () => {
    if (!canCheckout) return;
    setLoading(true);
    setError('');

    try {
      const idempotencyKey = getOrCreateCheckoutIdempotencyKey();
      const res = await api.post('/orders/create', {
        storeId: selectedStore!.id,
        customerPhone: formatPhone(phone),
        customerName: name || undefined,
        customerMessage: message || undefined,
        items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
      }, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });

      const { gateway, redirectUrl, razorpayOrderId, amount, keyId, orderId, accessToken, paymentStatus, phonepeMerchantTransactionId } = res.data.data;

      // A retry can return an order that was already paid after a prior network
      // failure. Complete the customer flow without opening Razorpay again.
      if (paymentStatus === 'PAID') {
        const statusRes = await api.get(`/orders/status/${orderId}`, { params: { token: accessToken } });
        const order = statusRes.data.data;
        clearCart();
        useCustomerOrdersStore.getState().addOrder(order);
        if (order.store?.name) downloadBillHtml(order, order.store.name, order.store.address || '');
        clearStore();
        navigate('/');
        return;
      }

      // PhonePe redirect-based checkout
      if (gateway === 'phonepe' && redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      await openRazorpayCheckout({
        orderId: razorpayOrderId,
        amount,
        keyId,
        currency: 'INR',
        customerPhone: formatPhone(phone),
        customerName: name || undefined,
        onSuccess: async (response) => {
          try {
            // Poll for status until PAID (webhook may have already processed)
            let statusRes = await api.get(`/orders/status/${orderId}`, { params: { token: accessToken } });
            if (statusRes.data.data?.paymentStatus !== 'PAID') {
              // Fallback: direct server verification if webhook hasn't arrived yet
              await api.post('/orders/verify', {
                orderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              });
              statusRes = await api.get(`/orders/status/${orderId}`, { params: { token: accessToken } });
            }

            const order = statusRes.data.data;
            if (order?.paymentStatus === 'PAID') {
              clearCart();

              // Save order to customer cache (1 day)
              useCustomerOrdersStore.getState().addOrder(order);

              // Auto-download bill
              if (order.store?.name) {
                try {
                  downloadBillHtml(order, order.store.name, order.store.address || '');
                } catch (e) {
                  console.error('Auto-download bill failed:', e);
                }
              }

              // Navigate to store selector (clear selected store so / shows StoreSelector)
              clearStore();
              navigate('/');
              return;
            }

            setError('Payment could not be verified. Please contact support.');
            setLoading(false);
          } catch (err: any) {
            setError(err.response?.data?.error || 'Payment verification failed. Please contact support.');
            setLoading(false);
          }
        },
        onDismiss: async () => {
          // User closed Razorpay modal. Check if payment actually succeeded via webhook or polling.
          setTimeout(async () => {
            try {
              const statusRes = await api.get(`/orders/status/${orderId}`, { params: { token: accessToken } });
              const order = statusRes.data.data;
              if (order?.paymentStatus === 'PAID') {
                clearCart();

                // Save to customer cache and auto-download bill
                useCustomerOrdersStore.getState().addOrder(order);
                if (order.store?.name) {
                  try { downloadBillHtml(order, order.store.name, order.store.address || ''); } catch (e) {}
                }

                clearStore();
                navigate('/');
              } else {
                setError('Payment was not completed. If money was deducted, it will be refunded within 5-7 business days.');
              }
            } catch {
              setError('Payment was not completed. If money was deducted, it will be refunded within 5-7 business days.');
            }
            setLoading(false);
          }, 3000);
        },
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Checkout failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-28 lg:pb-8">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Checkout</h1>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
        <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-gray-700">
                {item.name} <span className="text-gray-400">({item.category}) × {item.quantity}</span>
              </span>
              <span className="font-medium text-gray-900">{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal (excl. tax)</span>
            <span>{formatPrice(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>CGST</span>
            <span>{formatPrice(totals.cgst)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>SGST</span>
            <span>{formatPrice(totals.sgst)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
            <span>Total (incl. GST)</span>
            <span>{formatPrice(totals.total)}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 space-y-4">
        <h3 className="font-semibold text-gray-900">Customer Details</h3>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <Phone className="w-4 h-4 text-gray-400" /> Phone Number *
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
            placeholder="10 digit mobile number"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <User className="w-4 h-4 text-gray-400" /> Name (optional)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <MessageSquare className="w-4 h-4 text-gray-400" /> Preparation Note (optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Less spicy, extra sauce, etc."
            maxLength={200}
            rows={2}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-none"
          />
          <div className="text-right text-[10px] text-gray-400 mt-0.5">{message.length}/200</div>
        </div>
      </div>

      <div className="bg-accent-50 rounded-lg p-3 flex items-start gap-2 mb-4">
        <AlertCircle className="w-4 h-4 text-accent-600 shrink-0 mt-0.5" />
        <p className="text-xs text-accent-700 leading-relaxed">
          Pickup only. Orders cannot be cancelled once placed. Please collect your order at the store counter.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 rounded-lg p-3 flex items-start gap-2 mb-4">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={!canCheckout}
        className={cn(
          'w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition shadow-lg',
          canCheckout ? 'bg-brand-600 hover:bg-brand-700' : 'bg-gray-300 cursor-not-allowed'
        )}
      >
        <ShieldCheck className="w-5 h-5" />
        {loading ? 'Processing...' : `Pay ${formatPrice(totals.total)}`}
      </button>
    </div>
  );
}
