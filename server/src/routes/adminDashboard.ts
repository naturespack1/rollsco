import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../prismaClient';
import { generateDailySalesExcel } from '../services/exportService';
import { createInstoreOrder } from '../services/orderService';
import { authenticate } from '../plugins/auth';

const statusEnum = z.enum(['CREATED', 'PROCESSING', 'DELIVERED']);

const syncSchema = z.object({
  updates: z.array(
    z.object({
      orderId: z.string().uuid(),
      status: statusEnum,
    })
  ),
  lastSync: z.string().datetime().optional(),
});

const stockSchema = z.object({
  itemId: z.string().uuid(),
  stock: z.number().int().min(0),
});

const storeStatusSchema = z.object({
  isOpen: z.boolean().optional(),
  acceptingOrders: z.boolean().optional(),
}).refine((data) => data.isOpen !== undefined || data.acceptingOrders !== undefined, {
  message: 'At least one store status value is required.',
});

const instoreOrderSchema = z.object({
  storeId: z.string().uuid(),
  customerPhone: z.string().min(10).max(15),
  customerName: z.string().max(100).optional(),
  customerMessage: z.string().max(500).optional(),
  items: z.array(
    z.object({
      id: z.string().uuid(),
      quantity: z.number().int().min(1).max(20),
    })
  ).min(1),
});

const createItemSchema = z.object({
  storeId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  price: z.number().min(0),
  stock: z.number().int().min(0).default(0),
  gstRate: z.number().min(0).max(100).default(5),
  hsnCode: z.string().max(20).optional(),
  imageUrl: z.string().max(500).optional(),
  isBestseller: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
});

const updateItemSchema = z.object({
  itemId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  price: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  gstRate: z.number().min(0).max(100).optional(),
  hsnCode: z.string().max(20).optional(),
  imageUrl: z.string().max(500).optional(),
  isBestseller: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});

const createAdminSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(6).max(100),
  role: z.enum(['SUPER_ADMIN', 'MANAGER']),
  storeIds: z.array(z.string().uuid()).min(1),
});

export default async function adminDashboardRoutes(app: FastifyInstance) {
  // Middleware to enforce store access
  const enforceStoreAccess = async (request: any, reply: any, storeId: string) => {
    if (request.admin.role !== 'SUPER_ADMIN' && !request.admin.storeIds.includes(storeId)) {
      reply.status(403).send({ success: false, error: 'Access denied for this store.' });
      return false;
    }
    return true;
  };

  // ─── Store status ───

  app.patch('/stores/:storeId/status', { preHandler: [authenticate] }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string };
    const body = storeStatusSchema.parse(request.body);

    if (!(await enforceStoreAccess(request, reply, storeId))) return;

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return reply.status(404).send({ success: false, error: 'Store not found.' });

    const updated = await prisma.store.update({
      where: { id: storeId },
      data: {
        ...(body.isOpen !== undefined ? { isOpen: body.isOpen } : {}),
        ...(body.acceptingOrders !== undefined ? { acceptingOrders: body.acceptingOrders } : {}),
      },
      select: {
        id: true,
        name: true,
        address: true,
        isOpen: true,
        acceptingOrders: true,
      },
    });

    return { success: true, data: updated };
  });

  // ─── Instore orders ───

  app.post('/orders/instore', { preHandler: [authenticate] }, async (request, reply) => {
    const body = instoreOrderSchema.parse(request.body);
    if (!(await enforceStoreAccess(request, reply, body.storeId))) return;

    const order = await createInstoreOrder(
      body.storeId,
      body.customerPhone,
      body.customerName,
      body.customerMessage,
      body.items as { id: string; quantity: number }[]
    );

    return reply.status(201).send({ success: true, data: order });
  });

  // ─── Orders ───

  app.get('/orders', { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId as string;
    const status = query.status as string | undefined;
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));

    if (!storeId) return reply.status(400).send({ success: false, error: 'storeId required' });
    if (!(await enforceStoreAccess(request, reply, storeId))) return;

    const where: any = { storeId };
    if (status) where.status = status;

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: { items: { select: { itemName: true, quantity: true, unitPrice: true, totalPrice: true, basePrice: true, baseTotal: true, gstRate: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.order.count({ where }),
      ]);

    return { success: true, data: { orders, total, page, limit } };
  });

  app.post('/orders/sync', { preHandler: [authenticate] }, async (request, reply) => {
    const body = syncSchema.parse(request.body);
    const query = request.query as any;
    const storeId = query.storeId as string;
    if (!storeId) return reply.status(400).send({ success: false, error: 'storeId required' });
    if (!(await enforceStoreAccess(request, reply, storeId))) return;

    for (const up of body.updates) {
      await prisma.order.update({
        where: { id: up.orderId, storeId },
        data: { status: up.status },
      });
    }

    const where: any = { storeId };
    if (body.lastSync) {
      where.updatedAt = { gt: new Date(body.lastSync) };
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: { select: { itemName: true, quantity: true, unitPrice: true, totalPrice: true, basePrice: true, baseTotal: true, gstRate: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: { orders, syncTime: new Date().toISOString() } };
  });

  app.get('/orders/new', { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId as string;
    const after = query.after as string | undefined;
    if (!storeId) return reply.status(400).send({ success: false, error: 'storeId required' });
    if (!(await enforceStoreAccess(request, reply, storeId))) return;

    const where: any = { storeId };
    if (after) {
      where.createdAt = { gt: new Date(after) };
    } else {
      where.createdAt = { gt: new Date(Date.now() - 5 * 60 * 1000) };
    }

    const orders = await prisma.order.findMany({
      where,
      include: { items: { select: { itemName: true, quantity: true, unitPrice: true, totalPrice: true, basePrice: true, baseTotal: true, gstRate: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: orders };
  });

  // ─── Stock ───

  app.post('/stock', { preHandler: [authenticate] }, async (request, reply) => {
    const body = stockSchema.parse(request.body);
    const item = await prisma.item.findUnique({ where: { id: body.itemId }, include: { store: true } });
    if (!item) return reply.status(404).send({ success: false, error: 'Item not found' });
    if (!(await enforceStoreAccess(request, reply, item.storeId))) return;

    const updated = await prisma.item.update({
      where: { id: body.itemId },
      data: { stock: body.stock },
    });

    return { success: true, data: updated };
  });

  // ─── Menu / Items ───

  app.get('/menu/:storeId', { preHandler: [authenticate] }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string };
    if (!(await enforceStoreAccess(request as any, reply, storeId))) return;

    const items = await prisma.item.findMany({
      where: { storeId },
      include: { category: true },
      orderBy: { category: { sort: 'asc' } },
    });

    // Explicitly flatten category and store into the item response
    const serializedItems = items.map((i) => ({
      id: i.id,
      name: i.name,
      description: i.description,
      price: i.price.toNumber(),
      stock: i.stock,
      gstRate: i.gstRate.toNumber(),
      hsnCode: i.hsnCode,
      imageUrl: i.imageUrl,
      isBestseller: i.isBestseller,
      isAvailable: i.isAvailable,
      storeId: i.storeId,
      categoryId: i.categoryId,
      categoryName: i.category?.name || 'Unknown',
      category: i.category,
    }));

    return { success: true, data: { items: serializedItems } };
  });

  app.post('/items', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.admin.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ success: false, error: 'Only Super Admin can add items.' });
    }
    const body = createItemSchema.parse(request.body);
    if (!(await enforceStoreAccess(request, reply, body.storeId))) return;

    const item = await prisma.item.create({
      data: {
        storeId: body.storeId,
        categoryId: body.categoryId,
        name: body.name,
        description: body.description ?? null,
        price: body.price,
        stock: body.stock ?? 0,
        gstRate: body.gstRate ?? 5,
        hsnCode: body.hsnCode ?? null,
        imageUrl: body.imageUrl ?? null,
        isBestseller: body.isBestseller ?? false,
        isAvailable: body.isAvailable ?? true,
      },
    });
    return { success: true, data: item };
  });

  app.put('/items', { preHandler: [authenticate] }, async (request, reply) => {
    const body = updateItemSchema.parse(request.body);
    const existing = await prisma.item.findUnique({ where: { id: body.itemId }, include: { store: true } });
    if (!existing) return reply.status(404).send({ success: false, error: 'Item not found' });
    if (!(await enforceStoreAccess(request, reply, existing.storeId))) return;

    const { itemId, ...data } = body;
    const item = await prisma.item.update({
      where: { id: itemId },
      data,
    });
    return { success: true, data: item };
  });

  app.delete('/items/:itemId', { preHandler: [authenticate] }, async (request, reply) => {
    const { itemId } = request.params as { itemId: string };
    const item = await prisma.item.findUnique({ where: { id: itemId }, include: { store: true } });
    if (!item) return reply.status(404).send({ success: false, error: 'Item not found' });
    if (!(await enforceStoreAccess(request, reply, item.storeId))) return;

    await prisma.item.delete({ where: { id: itemId } });
    return { success: true };
  });

  app.get('/categories', { preHandler: [authenticate] }, async () => {
    const categories = await prisma.category.findMany({ orderBy: { sort: 'asc' } });
    return { success: true, data: categories };
  });

  // ─── Admin Users (Super Admin only) ───

  app.get('/admins', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.admin.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ success: false, error: 'Only Super Admin can manage staff.' });
    }
    const admins = await prisma.adminUser.findMany({
      include: { stores: { include: { store: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: admins };
  });

  app.post('/admins', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.admin.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ success: false, error: 'Only Super Admin can add staff.' });
    }
    const body = createAdminSchema.parse(request.body);
    const existing = await prisma.adminUser.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({ success: false, error: 'Email already exists.' });
    }

    const admin = await prisma.adminUser.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: body.role,
        stores: {
          create: body.storeIds.map((storeId) => ({ storeId })),
        },
      },
    });
    return { success: true, data: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } };
  });

  app.delete('/admins/:adminId', { preHandler: [authenticate] }, async (request, reply) => {
    if (request.admin.role !== 'SUPER_ADMIN') {
      return reply.status(403).send({ success: false, error: 'Only Super Admin can remove staff.' });
    }
    const { adminId } = request.params as { adminId: string };
    if (adminId === request.admin.id) {
      return reply.status(400).send({ success: false, error: 'Cannot delete yourself.' });
    }
    await prisma.adminUser.delete({ where: { id: adminId } });
    return { success: true };
  });

  // ─── Reports ───

  app.get('/bestsellers', { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId as string;
    const days = parseInt(query.days || '30', 10);
    if (!storeId) return reply.status(400).send({ success: false, error: 'storeId required' });
    if (!(await enforceStoreAccess(request as any, reply, storeId))) return;

    const since = days > 0
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      : new Date(0);

    const items = await prisma.$queryRaw`
      SELECT i.id, i.name, CAST(SUM(oi.quantity) AS INTEGER) as totalSold
      FROM "Item" i
      JOIN "OrderItem" oi ON oi."itemId" = i.id
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE i."storeId" = ${storeId}
        AND o."paymentStatus" = 'PAID'
        AND o."createdAt" >= ${since}
      GROUP BY i.id, i.name
      ORDER BY totalSold DESC
      LIMIT 10
    `;

    return { success: true, data: items };
  });

  app.get('/payment-summary', { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId as string;
    const requestedDays = parseInt(query.days || '30', 10);
    const days = Number.isFinite(requestedDays) ? Math.min(36500, Math.max(0, requestedDays)) : 30;

    if (!storeId) return reply.status(400).send({ success: false, error: 'storeId required' });
    if (!(await enforceStoreAccess(request as any, reply, storeId))) return;

    const since = days > 0
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      : undefined;

    const groups = await prisma.order.groupBy({
      by: ['paymentMethod'],
      where: {
        storeId,
        paymentStatus: 'PAID',
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      _sum: { total: true },
      _count: { _all: true },
    });

    const summary = {
      online: { amount: 0, orders: 0 },
      instore: { amount: 0, orders: 0 },
    };

    for (const group of groups) {
      const bucket = group.paymentMethod === 'INSTORE' ? summary.instore : summary.online;
      bucket.amount = group._sum.total?.toNumber() || 0;
      bucket.orders = group._count._all;
    }

    return {
      success: true,
      data: {
        ...summary,
        total: {
          amount: summary.online.amount + summary.instore.amount,
          orders: summary.online.orders + summary.instore.orders,
        },
      },
    };
  });

  app.get('/export/daily', { preHandler: [authenticate] }, async (request, reply) => {
    const query = request.query as any;
    const storeId = query.storeId as string;
    const dateStr = query.date as string;
    if (!storeId) return reply.status(400).send({ success: false, error: 'storeId required' });
    if (!(await enforceStoreAccess(request as any, reply, storeId))) return;

    const date = dateStr ? new Date(dateStr) : new Date();
    const buffer = await generateDailySalesExcel(storeId, date);

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="sales-${storeId}-${date.toISOString().slice(0, 10)}.xlsx"`);
    return reply.send(buffer);
  });
}
