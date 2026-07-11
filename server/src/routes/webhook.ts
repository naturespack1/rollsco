import { FastifyInstance } from 'fastify';
import { verifyWebhookSignature } from '../services/paymentService';
import { markOrderPaid, failOrder } from '../services/orderService';
import { env } from '../config';

export default async function webhookRoutes(app: FastifyInstance) {
  app.post('/razorpay', async (request, reply) => {
    const signature = request.headers['x-razorpay-signature'] as string;
    const body = JSON.stringify(request.body);

    if (!env.RAZORPAY_WEBHOOK_SECRET) {
      app.log.warn('Webhook secret not configured');
      return reply.status(500).send({ success: false, error: 'Webhook not configured' });
    }

    if (!signature || !verifyWebhookSignature(body, signature)) {
      return reply.status(400).send({ success: false, error: 'Invalid signature' });
    }

    const event = request.body as any;
    const payload = event.payload?.payment?.entity || event.payload?.order?.entity || {};

    try {
      if (event.event === 'payment.captured') {
        const razorpayOrderId = payload.order_id;
        const razorpayPaymentId = payload.id;

        if (!razorpayOrderId) return reply.send({ received: true });

        await markOrderPaid(razorpayOrderId, razorpayPaymentId);
      }

      if (event.event === 'payment.failed') {
        const razorpayOrderId = payload.order_id;
        if (razorpayOrderId) {
          await failOrder(razorpayOrderId);
        }
      }

      if (event.event === 'order.paid') {
        const razorpayOrderId = payload.id;
        const razorpayPaymentId = payload.payment_id || payload.notes?.payment_id;
        if (razorpayOrderId) {
          await markOrderPaid(razorpayOrderId, razorpayPaymentId || '');
        }
      }

      return reply.send({ received: true });
    } catch (err: any) {
      app.log.error(err);
      // Return 200 to Razorpay so they don't retry infinitely, but log error
      return reply.status(200).send({ received: true, warning: err.message });
    }
  });
}
