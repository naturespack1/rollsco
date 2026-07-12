import { FastifyInstance } from 'fastify';
import {
  createWebhookDedupeKey,
  markPaymentEventProcessed,
  recordPaymentEvent,
  verifyWebhookSignature,
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
}
