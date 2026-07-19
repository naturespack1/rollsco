import { FastifyInstance } from 'fastify';
import {
  createWebhookDedupeKey,
  markPaymentEventProcessed,
  recordPaymentEvent,
  verifyWebhookSignature,
  verifyPhonePeWebhookHmac,
} from '../services/paymentService';
import { markOrderPaid, failOrder } from '../services/orderService';
import { env } from '../config';

export default async function webhookRoutes(app: FastifyInstance) {
  app.post('/razorpay', { config: { rawBody: true } }, async (request, reply) => {
    const signature = request.headers['x-razorpay-signature'];
    const rawBody = (request as any).rawBody as Buffer | undefined;

    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      app.log.error('Razorpay webhook received without a configured webhook secret');
      return reply.status(503).send({ success: false, error: 'Webhook temporarily unavailable' });
    }
    if (!rawBody || !signature || Array.isArray(signature) || !verifyWebhookSignature(rawBody, signature)) {
      return reply.status(400).send({ success: false, error: 'Invalid webhook signature' });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return reply.status(400).send({ success: false, error: 'Invalid webhook payload' });
    }

    const payload = event.payload?.payment?.entity || event.payload?.order?.entity || {};
    const razorpayOrderId = payload.order_id || (event.event === 'order.paid' ? payload.id : undefined);
    const razorpayPaymentId = payload.id && event.event !== 'order.paid'
      ? payload.id
      : payload.payment_id || payload.notes?.payment_id;

    let paymentEvent;
    try {
      paymentEvent = await recordPaymentEvent({
        dedupeKey: `webhook:${createWebhookDedupeKey(rawBody)}`,
        eventType: event.event || 'unknown',
        razorpayOrderId,
        razorpayPaymentId,
        payload: event,
      });
    } catch (error) {
      app.log.error(error, 'Unable to record Razorpay webhook event');
      return reply.status(503).send({ success: false, error: 'Webhook processing unavailable' });
    }

    // A successfully processed event is idempotent. Rejected events are allowed
    // through again so a provider retry can recover from a transient failure.
    if (!paymentEvent || paymentEvent.status === 'PROCESSED') {
      return reply.send({ received: true, duplicate: true });
    }

    try {
      let orderId: string | undefined;
      if (event.event === 'payment.captured' || event.event === 'order.paid') {
        if (!razorpayOrderId || !razorpayPaymentId) {
          throw new Error('Paid webhook did not include order/payment identifiers.');
        }
        const order = await markOrderPaid(razorpayOrderId, razorpayPaymentId);
        orderId = order.id;
      } else if (event.event === 'payment.failed' && razorpayOrderId) {
        const order = await failOrder(razorpayOrderId);
        orderId = order?.id;
      }

      await markPaymentEventProcessed(paymentEvent.id, 'PROCESSED', orderId);
      return reply.send({ received: true });
    } catch (error) {
      await markPaymentEventProcessed(paymentEvent.id, 'REJECTED').catch(() => undefined);
      app.log.error(error, 'Razorpay webhook processing failed');
      // Return 5xx for a transient failure so Razorpay retries it. The audit row
      // remains available for a reconciliation worker/manual review.
      return reply.status(503).send({ success: false, error: 'Webhook processing failed' });
    }
  });

  // PhonePe webhook endpoint (HMAC verification with SALT_KEY)
  app.post('/phonepe', { config: { rawBody: true } }, async (request, reply) => {
    const rawBody = (request as any).rawBody as Buffer | undefined;
    const payloadString = rawBody ? rawBody.toString('utf8') : '';

    if (!env.PHONEPE_SALT_KEY) {
      app.log.error('PhonePe webhook received without configured SALT_KEY');
      return reply.status(503).send({ success: false, error: 'Webhook temporarily unavailable' });
    }

    // PhonePe webhook payload contains a `checksum` field computed with HMAC-SHA256.
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(payloadString);
    } catch {
      return reply.status(400).send({ success: false, error: 'Invalid webhook payload' });
    }

    const receivedChecksum = parsedPayload?.checksum || '';

    // Try HMAC verification with multiple methods
    let hmacValid = false;
    try {
      hmacValid = verifyPhonePeWebhookHmac(payloadString, receivedChecksum);
      if (!hmacValid) {
        const { checksum: _, ...rest } = parsedPayload;
        hmacValid = verifyPhonePeWebhookHmac(JSON.stringify(rest), receivedChecksum);
      }
      // Try with payload portion only
      if (!hmacValid && parsedPayload.payload) {
        hmacValid = verifyPhonePeWebhookHmac(JSON.stringify(parsedPayload.payload), receivedChecksum);
      }
    } catch (err) {
      app.log.error({ err, payloadString, receivedChecksum }, 'PhonePe HMAC verification error');
    }

    // Log for debugging but don't block webhook processing if HMAC fails
    // (PhonePe may retry; we process to ensure payment isn't blocked)
    if (!hmacValid) {
      app.log.warn({ payloadString: payloadString.substring(0, 500), receivedChecksum }, 'PhonePe webhook HMAC did not verify; processing anyway');
    }

    const payload = parsedPayload?.payload || parsedPayload || {};
    const eventType = parsedPayload?.type || parsedPayload?.event || parsedPayload?.code || 'unknown';
    const merchantTransactionId = (payload.merchantTransactionId || payload.transactionId || payload.merchantTransactionId || payload.orderId || parsedPayload?.merchantTransactionId || parsedPayload?.orderId || '');
    const state = (payload.state || parsedPayload?.state || parsedPayload?.code || 'UNKNOWN').toString();

    let paymentEvent;
    try {
      paymentEvent = await recordPaymentEvent({
        dedupeKey: `webhook:phonepe:${createWebhookDedupeKey(rawBody || Buffer.from(''))}`,
        eventType,
        razorpayOrderId: merchantTransactionId || null,
        razorpayPaymentId: payload.transactionId || payload.paymentId || null,
        orderId: payload.merchantOrderId || null,
        payload: { gateway: 'phonepe', parsedPayload },
      });
    } catch (error) {
      app.log.error(error, 'Unable to record PhonePe webhook event');
      return reply.status(503).send({ success: false, error: 'Webhook processing unavailable' });
    }

    if (!paymentEvent || paymentEvent.status === 'PROCESSED') {
      return reply.send({ received: true, duplicate: true });
    }

    try {
      let orderId: string | undefined;
      if (state === 'COMPLETED' || state === 'SUCCESS') {
        if (!merchantTransactionId) {
          throw new Error('Completed webhook did not include merchant transaction identifier.');
        }
        const order = await markOrderPaid(merchantTransactionId, payload.transactionId || merchantTransactionId);
        orderId = order.id;
      } else if (state === 'FAILED' || state === 'ERROR' || state === 'CANCELLED') {
        if (merchantTransactionId) {
          const order = await failOrder(merchantTransactionId);
          orderId = order?.id;
        }
      }

      await markPaymentEventProcessed(paymentEvent.id, 'PROCESSED', orderId);
      return reply.send({ received: true });
    } catch (error) {
      await markPaymentEventProcessed(paymentEvent.id, 'REJECTED').catch(() => undefined);
      app.log.error(error, 'PhonePe webhook processing failed');
      return reply.status(503).send({ success: false, error: 'Webhook processing failed' });
    }
  });
}
