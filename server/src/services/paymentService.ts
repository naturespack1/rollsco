import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { env } from '../config';
import { prisma } from '../prismaClient';

let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay key_id and key_secret are not configured.');
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

/** Validates a Razorpay webhook against the exact received payload bytes. */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET || !signature) return false;

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest();

  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
}

export function createWebhookDedupeKey(rawBody: Buffer): string {
  return crypto.createHash('sha256').update(rawBody).digest('hex');
}

export async function recordPaymentEvent(input: {
  dedupeKey: string;
  eventType: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  orderId?: string;
  payload: Prisma.InputJsonValue;
}) {
  try {
    return await prisma.paymentEvent.create({
      data: {
        provider: 'RAZORPAY',
        dedupeKey: input.dedupeKey,
        eventType: input.eventType,
        razorpayOrderId: input.razorpayOrderId || null,
        razorpayPaymentId: input.razorpayPaymentId || null,
        orderId: input.orderId || null,
        payload: input.payload,
      },
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return prisma.paymentEvent.findUnique({ where: { dedupeKey: input.dedupeKey } });
    }
    throw error;
  }
}

export async function markPaymentEventProcessed(eventId: string, status: 'PROCESSED' | 'REJECTED', orderId?: string) {
  await prisma.paymentEvent.update({
    where: { id: eventId },
    data: {
      status,
      orderId: orderId || undefined,
      processedAt: new Date(),
    },
  });
}

export async function fetchOrderPayments(razorpayOrderId: string) {
  return getRazorpay().orders.fetchPayments(razorpayOrderId);
}

export async function fetchPayment(paymentId: string) {
  return getRazorpay().payments.fetch(paymentId);
}

export async function refundPayment(paymentId: string, amountInPaise: number) {
  return getRazorpay().payments.refund(paymentId, { amount: amountInPaise });
}
