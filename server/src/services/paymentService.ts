import Razorpay from 'razorpay';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { env } from '../config';
import { prisma } from '../prismaClient';

// PhonePe SDK import (installed from official private repo)
import { StandardCheckoutClient, Env, StandardCheckoutPayRequest, CreateSdkOrderRequest } from 'pg-sdk-node';

let razorpayInstance: Razorpay | null = null;
let phonepeClient: any = null;

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

function getPhonePeClient(): any {
  if (!phonepeClient) {
    if (!env.PHONEPE_CLIENT_ID || !env.PHONEPE_CLIENT_SECRET) {
      throw new Error('PhonePe CLIENT_ID and CLIENT_SECRET are not configured.');
    }
    const clientEnv = env.PHONEPE_ENV === 'PRODUCTION' ? Env.PRODUCTION : Env.SANDBOX;
    phonepeClient = StandardCheckoutClient.getInstance(
      env.PHONEPE_CLIENT_ID,
      env.PHONEPE_CLIENT_SECRET,
      env.PHONEPE_CLIENT_VERSION,
      clientEnv
    );
  }
  return phonepeClient;
}

export async function createPaymentOrder(amountInPaise: number, receipt: string, notes: Record<string, string>) {
  if (env.PAYMENT_GATEWAY === 'phonepe') {
    const merchantOrderId = receipt || notes.orderId || `order-${Date.now()}`;
    const redirectUrl = notes.redirectUrl || `${env.FRONTEND_ORIGIN || 'http://localhost:3000'}/order/success`;
    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amountInPaise)
      .redirectUrl(redirectUrl)
      .build();
    const response = await getPhonePeClient().pay(request);
    return {
      id: merchantOrderId,
      redirectUrl: (response as any)?.redirectUrl || (response as any)?.instrumentResponse?.redirectInfo?.url || undefined,
    };
  }
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
  const provider = env.PAYMENT_GATEWAY === 'phonepe' ? 'PHONEPE' : 'RAZORPAY';
  try {
    return await prisma.paymentEvent.create({
      data: {
        provider,
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

export async function fetchOrderPayments(orderId: string) {
  if (env.PAYMENT_GATEWAY === 'phonepe') {
    // PhonePe SDK does not expose a direct "fetch payments for order" endpoint in the same way.
    // We use getOrderStatus to retrieve the latest state and any payment details.
    return await getPhonePeClient().getOrderStatus(orderId);
  }
  return getRazorpay().orders.fetchPayments(orderId);
}

export async function fetchPayment(paymentId: string) {
  if (env.PAYMENT_GATEWAY === 'phonepe') {
    // For PhonePe, the payment/transaction ID corresponds to the merchant transaction ID.
    // We return the order status which includes the transaction state.
    return await getPhonePeClient().getOrderStatus(paymentId);
  }
  return getRazorpay().payments.fetch(paymentId);
}

export async function refundPayment(paymentId: string, amountInPaise: number) {
  if (env.PAYMENT_GATEWAY === 'phonepe') {
    // PhonePe SDK does not expose a direct refund method in StandardCheckoutClient.
    // Refunds are handled via PhonePe merchant portal or a separate refund API.
    // This is a placeholder to maintain interface compatibility.
    throw new Error('PhonePe refunds must be initiated through the PhonePe merchant portal or a dedicated refund endpoint.');
  }
  return getRazorpay().payments.refund(paymentId, { amount: amountInPaise });
}

export function verifyPhonePeWebhookHmac(rawPayloadString: string, checksumFromPayloadOrHeader: string): boolean {
  if (!env.PHONEPE_SALT_KEY) {
    throw new Error('PhonePe SALT_KEY is not configured for webhook verification.');
  }
  const hash = crypto.createHash('sha256').update(rawPayloadString + env.PHONEPE_SALT_KEY).digest('hex');
  const expected = `${hash}###${env.PHONEPE_SALT_INDEX}`;
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(checksumFromPayloadOrHeader || '');
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
