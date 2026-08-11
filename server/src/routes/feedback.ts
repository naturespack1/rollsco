import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prismaClient';

export default async function feedbackRoutes(app: FastifyInstance) {
  // Public: submit feedback for an order (customer)
  // Requires orderId + token (customerAccessToken) to verify ownership
  // No foreign key to Order table – orderId is stored as plain reference
  // to make order cleanup easier.
  app.post('/', async (request, reply) => {
    const bodySchema = z.object({
      orderId: z.string().uuid(),
      token: z.string().uuid(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(1000).optional(),
    });

    const body = bodySchema.parse(request.body);

    // Verify order ownership and that it's paid
    const order = await prisma.order.findFirst({
      where: { id: body.orderId, customerAccessToken: body.token },
      select: {
        id: true,
        orderNo: true,
        storeId: true,
        paymentStatus: true,
        customerPhone: true,
        customerName: true,
        total: true,
      },
    });

    if (!order) {
      return reply.status(404).send({ success: false, error: 'Order not found. Invalid token.' });
    }

    if (order.paymentStatus !== 'PAID') {
      return reply.status(400).send({ success: false, error: 'Feedback can only be given for paid orders.' });
    }

    const existing = await prisma.feedback.findUnique({ where: { orderId: body.orderId }, select: { id: true } });
    if (existing) {
      return reply.status(409).send({ success: false, error: 'Feedback already submitted for this order.' });
    }

    const feedback = await prisma.feedback.create({
      data: {
        orderId: order.id,
        orderNo: order.orderNo,
        storeId: order.storeId,
        rating: body.rating,
        comment: body.comment || null,
        customerPhone: order.customerPhone,
        customerName: order.customerName,
        orderTotal: order.total,
      },
      select: {
        id: true,
        orderId: true,
        orderNo: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    });

    return reply.status(201).send({ success: true, data: feedback });
  });

  // Public: get feedback for an order (to check if already given)
  app.get('/order/:orderId', async (request, reply) => {
    const paramsSchema = z.object({ orderId: z.string().uuid() });
    const querySchema = z.object({ token: z.string().uuid() });

    const params = paramsSchema.parse(request.params);
    const query = querySchema.parse(request.query);

    const order = await prisma.order.findFirst({
      where: { id: params.orderId, customerAccessToken: query.token },
      select: { id: true },
    });

    if (!order) {
      return reply.status(404).send({ success: false, error: 'Order not found. Invalid token.' });
    }

    const feedback = await prisma.feedback.findUnique({
      where: { orderId: params.orderId },
      select: { id: true, rating: true, comment: true, createdAt: true, orderNo: true },
    });

    return { success: true, data: feedback }; // null if not given yet
  });
}
