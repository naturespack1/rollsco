import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../prismaClient';
import { checkoutAbuseGuard } from '../plugins/abuseProtection';
import { createPendingOrder, markOrderPaid } from '../services/orderService';
import { recordPaymentEvent, fetchPayment } from '../services/paymentService';
import { env } from '../config';

const cartSchema = z.object({
  storeId: z.string().uuid(),
  customerPhone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.'),
  customerName: z.string().trim().min(1).max(100).optional(),
  customerMessage: z.string().trim().max(500).optional(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      quantity: z.number().int().min(1).max(20),
    })
  ).min(1).max(30),
});

const idempotencyKeySchema = z.string().uuid();

function buildCheckoutPayload(order: {
  id: string;
  orderNo: string;
  customerAccessToken: string;
  paymentStatus: string;
  razorpayOrderId: string | null;
  total: Prisma.Decimal;
}, redirectUrl?: string) {
  const payload: any = {
    orderId: order.id,
    orderNo: order.orderNo,
    accessToken: order.customerAccessToken,
    paymentStatus: order.paymentStatus,
    razorpayOrderId: order.razorpayOrderId,
    amount: Math.round(order.total.toNumber() * 100),
    currency: 'INR',
    gateway: env.PAYMENT_GATEWAY,
  };

  if (env.PAYMENT_GATEWAY === 'razorpay') {
    payload.keyId = env.RAZORPAY_KEY_ID;
    payload.razorpayOrderId = order.razorpayOrderId;
  } else if (env.PAYMENT_GATEWAY === 'phonepe') {
    payload.phonepeMerchantTransactionId = order.razorpayOrderId; // reused DB field
    payload.redirectUrl = redirectUrl;
  }

  return payload;
}

function cartMatchesOrder(
  body: z.infer<typeof cartSchema>,
  order: { storeId: string; customerPhone: string; items: { itemId: string; quantity: number }[] }
) {
  if (body.storeId !== order.storeId || body.customerPhone !== order.customerPhone) return false;

  const requested = new Map<string, number>();
  for (const item of body.items) requested.set(item.id, (requested.get(item.id) || 0) + item.quantity);
  const stored = new Map(order.items.map((item) => [item.itemId, item.quantity]));

  return requested.size === stored.size
    && [...requested.entries()].every(([itemId, quantity]) => stored.get(itemId) === quantity);
}

async function findIdempotentOrder(idempotencyKey: string) {
  return prisma.order.findUnique({
    where: { idempotencyKey },
    include: { items: { select: { itemId: true, quantity: true } } },
  });
}

export default async function orderRoutes(app: FastifyInstance) {
  app.post('/create', {
    preHandler: [checkoutAbuseGuard],
  }, async (request, reply) => {
    const body = cartSchema.parse(request.body);
    const idempotencyHeader = request.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(idempotencyHeader) ? idempotencyHeader[0] : idempotencyHeader;
    const parsedIdempotencyKey = idempotencyKeySchema.safeParse(idempotencyKey);
    if (!parsedIdempotencyKey.success) {
      return reply.status(400).send({ success: false, error: 'A valid Idempotency-Key header is required.' });
    }

    const existing = await findIdempotentOrder(parsedIdempotencyKey.data);
    if (existing) {
      if (!cartMatchesOrder(body, existing)) {
        return reply.status(409).send({ success: false, error: 'Idempotency key was already used with a different order.' });
      }
      if (existing.paymentStatus === 'FAILED') {
        return reply.status(409).send({ success: false, error: 'The previous payment attempt expired. Start a new checkout.' });
      }
      if (existing.paymentStatus === 'PENDING' && !existing.razorpayOrderId) {
        return reply.status(409).send({ success: false, error: 'The previous checkout is still being created. Please retry shortly.' });
      }
      return reply.send({ success: true, data: buildCheckoutPayload(existing) });
    }

    const store = await prisma.store.findUnique({ where: { id: body.storeId } });
    if (!store || !store.isOpen || !store.acceptingOrders) {
      return reply.status(400).send({ success: false, error: 'Store is not accepting orders currently.' });
    }

    try {
      const result = await createPendingOrder(
        body.storeId,
        body.customerPhone,
        body.customerName,
        body.customerMessage,
        body.items as { id: string; quantity: number }[],
        parsedIdempotencyKey.data
      );

      return reply.status(201).send({ success: true, data: buildCheckoutPayload({
        ...result.order,
        razorpayOrderId: result.razorpayOrderId,
      }, (result as any).redirectUrl) });
    } catch (error: any) {
      // A duplicated request can race before the first transaction commits.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const racedOrder = await findIdempotentOrder(parsedIdempotencyKey.data);
        if (racedOrder && cartMatchesOrder(body, racedOrder) && racedOrder.razorpayOrderId) {
          return reply.send({ success: true, data: buildCheckoutPayload(racedOrder) });
        }
      }

      app.log.error(error, 'Order creation failed');
      const message = error instanceof Error && /out of stock|unavailable|maximum|changed while/i.test(error.message)
        ? error.message
        : 'Order creation failed. Please try again.';
      return reply.status(400).send({ success: false, error: message });
    }
  });

  // Customer-visible order state requires both the order UUID and the separate
  // high-entropy access token returned only to the checkout client.
  app.get('/status/:orderId', async (request, reply) => {
    const params = z.object({ orderId: z.string().uuid() }).parse(request.params);
    const query = z.object({ token: z.string().uuid() }).parse(request.query);

    const order = await prisma.order.findFirst({
      where: { id: params.orderId, customerAccessToken: query.token },
      include: {
        store: { select: { name: true, address: true } },
        items: { select: { itemName: true, quantity: true, unitPrice: true, totalPrice: true, basePrice: true, baseTotal: true, gstRate: true } },
      },
    });
    if (!order) return reply.status(404).send({ success: false, error: 'Order not found' });
    return { success: true, data: order };
  });

  app.post('/verify', {
    preHandler: [checkoutAbuseGuard],
  }, async (request, reply) => {
    if (env.PAYMENT_GATEWAY === 'phonepe') {
      // PhonePe uses redirect + server-side webhook confirmation.
      // Client should poll /status instead of calling /verify with a signature.
      const verifySchemaPhonePe = z.object({
        orderId: z.string().uuid(),
        merchantTransactionId: z.string().min(1).max(100),
      });
      try {
        const body = verifySchemaPhonePe.parse(request.body);
        const pendingOrder = await prisma.order.findUnique({ where: { id: body.orderId } });
        if (!pendingOrder || pendingOrder.razorpayOrderId !== body.merchantTransactionId) {
          return reply.status(400).send({ success: false, error: 'Transaction does not match this order.' });
        }
        // Verify status via PhonePe SDK
        const statusResponse: any = await fetchPayment(body.merchantTransactionId);
        const state = statusResponse?.state || statusResponse?.payload?.state || 'UNKNOWN';
        if (state === 'COMPLETED' || state === 'SUCCESS') {
          const order = await markOrderPaid(body.merchantTransactionId, body.merchantTransactionId);
          await recordPaymentEvent({
            dedupeKey: `client-verification:${body.merchantTransactionId}`,
            eventType: 'client.payment_verified',
            razorpayOrderId: body.merchantTransactionId,
            razorpayPaymentId: body.merchantTransactionId,
            orderId: order.id,
            payload: { gateway: 'phonepe', merchantTransactionId: body.merchantTransactionId, state },
          });
          return { success: true, data: order };
        }
        return reply.status(400).send({ success: false, error: 'Payment has not been completed yet.' });
      } catch (err: any) {
        return reply.status(400).send({ success: false, error: err.message || 'PhonePe verification failed.' });
      }
    }

    // Razorpay verification flow
    const verifySchema = z.object({
      orderId: z.string().uuid(),
      razorpayPaymentId: z.string().min(1).max(100),
      razorpayOrderId: z.string().min(1).max(100),
      razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/i),
    });
    const body = verifySchema.parse(request.body);

    if (!env.RAZORPAY_KEY_SECRET) {
      return reply.status(503).send({ success: false, error: 'Payment verification is not configured.' });
    }

    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(body.razorpaySignature, 'hex');
    if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
      return reply.status(400).send({ success: false, error: 'Invalid payment signature.' });
    }

    const pendingOrder = await prisma.order.findUnique({ where: { id: body.orderId } });
    if (!pendingOrder || pendingOrder.razorpayOrderId !== body.razorpayOrderId) {
      return reply.status(400).send({ success: false, error: 'Payment does not match this order.' });
    }

    try {
      const order = await markOrderPaid(body.razorpayOrderId, body.razorpayPaymentId);
      await recordPaymentEvent({
        dedupeKey: `client-verification:${body.razorpayPaymentId}`,
        eventType: 'client.payment_verified',
        razorpayOrderId: body.razorpayOrderId,
        razorpayPaymentId: body.razorpayPaymentId,
        orderId: order.id,
        payload: body,
      });
      return { success: true, data: order };
    } catch (error) {
      app.log.error(error, 'Payment verification failed');
      return reply.status(409).send({
        success: false,
        error: 'Payment could not be applied automatically. Please contact support if funds were deducted.',
      });
    }
  });
}
