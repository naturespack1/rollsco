import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../prismaClient';
import { createPendingOrder, markOrderPaid, failOrder } from '../services/orderService';
import { env } from '../config';

const cartSchema = z.object({
  storeId: z.string().uuid(),
  customerPhone: z.string().min(10).max(15),
  customerName: z.string().optional(),
  customerMessage: z.string().max(500).optional(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      quantity: z.number().int().min(1).max(20),
    })
  ).min(1),
});

export default async function orderRoutes(app: FastifyInstance) {
  // Customer creates order (server calculates price)
  app.post('/create', async (request, reply) => {
    const body = cartSchema.parse(request.body);

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
        body.items
      );

      return reply.send({
        success: true,
        data: {
          orderId: result.order.id,
          orderNo: result.order.orderNo,
          razorpayOrderId: result.razorpayOrderId,
          amount: result.amount,
          keyId: env.RAZORPAY_KEY_ID,
          currency: 'INR',
        },
      });
    } catch (err: any) {
      app.log.error(err);
      return reply.status(400).send({ success: false, error: err.message || 'Order creation failed.' });
    }
  });

  // Verify payment status (client polls after payment attempt)
  app.get('/status/:orderId', async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        store: { select: { name: true, address: true } },
        items: { select: { itemName: true, quantity: true, unitPrice: true, totalPrice: true, basePrice: true, baseTotal: true, gstRate: true } },
      },
    });
    if (!order) return reply.status(404).send({ success: false, error: 'Order not found' });
    return { success: true, data: order };
  });

  // Public order details by orderNo (for receipt page)
  app.get('/receipt/:orderNo', async (request, reply) => {
    const { orderNo } = request.params as { orderNo: string };
    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: {
        store: { select: { name: true, address: true } },
        items: { select: { itemName: true, quantity: true, unitPrice: true, totalPrice: true, basePrice: true, baseTotal: true, gstRate: true } },
      },
    });
    if (!order) return reply.status(404).send({ success: false, error: 'Order not found' });
    return { success: true, data: order };
  });

  // Client-side payment verification (replaces webhook for development)
  app.post('/verify', async (request, reply) => {
    const verifySchema = z.object({
      orderId: z.string().uuid(),
      razorpayPaymentId: z.string().min(1),
      razorpayOrderId: z.string().min(1),
      razorpaySignature: z.string().min(1),
    });
    const body = verifySchema.parse(request.body);

    if (!env.RAZORPAY_KEY_SECRET) {
      return reply.status(500).send({ success: false, error: 'Payment verification not configured' });
    }

    // Verify Razorpay signature: HMAC-SHA256(order_id + "|" + payment_id, key_secret)
    const expected = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(`${body.razorpayOrderId}|${body.razorpayPaymentId}`)
      .digest('hex');

    if (expected !== body.razorpaySignature) {
      return reply.status(400).send({ success: false, error: 'Invalid payment signature' });
    }

    try {
      const order = await markOrderPaid(body.razorpayOrderId, body.razorpayPaymentId);
      return { success: true, data: order };
    } catch (err: any) {
      app.log.error(err);
      return reply.status(400).send({ success: false, error: err.message || 'Payment verification failed' });
    }
  });
}
