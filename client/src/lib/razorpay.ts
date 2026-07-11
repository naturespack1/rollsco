import { api } from './api';

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: {
    name?: string;
    contact: string;
  };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal: {
    ondismiss: () => void;
    escape: boolean;
    backdropclose: boolean;
  };
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void; on: (event: string, cb: () => void) => void };
  }
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-script')) return resolve(true);
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout({
  orderId,
  amount,
  keyId,
  currency,
  customerPhone,
  customerName,
  onSuccess,
  onDismiss,
}: {
  orderId: string;
  amount: number;
  keyId: string;
  currency: string;
  customerPhone: string;
  customerName?: string;
  onSuccess: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  onDismiss: () => void;
}) {
  const loaded = await loadRazorpayScript();
  if (!loaded) throw new Error('Failed to load Razorpay');

  const rzp = new window.Razorpay({
    key: keyId,
    amount,
    currency,
    order_id: orderId,
      name: 'Rolls & Co.',
    description: 'Order Payment',
    prefill: { name: customerName || '', contact: customerPhone },
    handler: (response) => {
      onSuccess(response);
    },
    modal: {
      ondismiss: () => onDismiss(),
      escape: true,
      backdropclose: false,
    },
  });

  rzp.open();
}
