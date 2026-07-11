import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config';

let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay key_id and key_secret are not configured. Check your .env file.');
    }
    razorpayInstance = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

export async function createRazorpayOrder(amountInPaise: number, receipt: string, notes: Record<string, string>) {
  return getRazorpay().orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt,
    notes,
    payment_capture: true,
  });
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  return expected === signature;
}

export async function fetchPayment(paymentId: string) {
  return getRazorpay().payments.fetch(paymentId);
}

export async function refundPayment(paymentId: string, amountInPaise: number) {
  return getRazorpay().payments.refund(paymentId, { amount: amountInPaise });
}
