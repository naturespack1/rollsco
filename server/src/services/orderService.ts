import { Prisma } from '@prisma/client';
import { env } from '../config';
import { prisma } from '../prismaClient';
import { calculateGstFromInclusive } from '../utils/gstCalc';
import { generateOrderNumber } from '../utils/orderNumber';
import { createPaymentOrder } from './paymentService';
import { sendOrderSms } from './smsService';

interface CartItem {
  id: string;
  quantity: number;
}

interface OrderCreationOptions {
  paymentStatus: 'PENDING' | 'PAID';
  paymentMethod: 'ONLINE' | 'INSTORE';
  idempotencyKey?: string;
  createdByAdminId?: string;
}

interface LineItem {
  name: string;
  inclusivePrice: number;
  quantity: number;
  gstRate: number;
  itemId: string;
}

const MAX_DISTINCT_CART_ITEMS = 30;

/**
 * Validates the cart, conditionally deducts stock, and persists an order in a
 * single serializable transaction. Payment processing is intentionally left to
 * the caller so online and instore orders share the same inventory/GST rules.
 */
async function createOrderWithStock(
  storeId: string,
  customerPhone: string,
  customerName: string | undefined,
  customerMessage: string | undefined,
  cartItems: CartItem[],
  options: OrderCreationOptions
) {
  return prisma.$transaction(async (tx) => {
    const quantitiesByItemId = new Map<string, number>();
    for (const cartItem of cartItems) {
      quantitiesByItemId.set(
        cartItem.id,
        (quantitiesByItemId.get(cartItem.id) || 0) + cartItem.quantity
      );
    }

    const normalizedCartItems = Array.from(quantitiesByItemId, ([id, quantity]) => ({ id, quantity }));
    if (normalizedCartItems.length > MAX_DISTINCT_CART_ITEMS) {
      throw new Error(`A maximum of ${MAX_DISTINCT_CART_ITEMS} different items can be ordered.`);
    }
    if (normalizedCartItems.some((cartItem) => cartItem.quantity > 20)) {
      throw new Error('A maximum of 20 units per item can be ordered.');
    }

    const itemIds = normalizedCartItems.map((cartItem) => cartItem.id);
    const items = await tx.item.findMany({
      where: { id: { in: itemIds }, storeId },
    });
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const lineItems: LineItem[] = [];

    for (const cartItem of normalizedCartItems) {
      const item = itemMap.get(cartItem.id);
      if (!item) throw new Error(`Item not found: ${cartItem.id}`);
      if (!item.isAvailable) throw new Error(`${item.name} is currently unavailable.`);
      if (item.stock < cartItem.quantity) {
        throw new Error(`${item.name} is out of stock. Only ${item.stock} left.`);
      }

      lineItems.push({
        name: item.name,
        inclusivePrice: item.price.toNumber(),
        quantity: cartItem.quantity,
        gstRate: item.gstRate.toNumber(),
        itemId: item.id,
      });
    }

    // Re-check stock at write time. This prevents an absolute stock update or a
    // concurrent order from silently allowing negative inventory.
    for (const cartItem of normalizedCartItems) {
      const updated = await tx.item.updateMany({
        where: {
          id: cartItem.id,
          storeId,
          isAvailable: true,
          stock: { gte: cartItem.quantity },
        },
        data: { stock: { decrement: cartItem.quantity } },
      });
      if (updated.count !== 1) {
        throw new Error('One or more items changed while the order was being placed. Please refresh and try again.');
      }
    }

    const gstCalc = calculateGstFromInclusive(
      lineItems.map((lineItem) => ({
        inclusivePrice: lineItem.inclusivePrice,
        quantity: lineItem.quantity,
        gstRate: lineItem.gstRate,
      }))
    );
    const orderNo = await generateOrderNumber(tx);

    const order = await tx.order.create({
      data: {
        orderNo,
        storeId,
        customerPhone,
        customerName: customerName || null,
        customerMessage: customerMessage || null,
        createdByAdminId: options.createdByAdminId || null,
        status: 'CREATED',
        paymentStatus: options.paymentStatus,
        paymentMethod: options.paymentMethod,
        subtotal: gstCalc.subtotal,
        cgstAmount: gstCalc.cgstAmount,
        sgstAmount: gstCalc.sgstAmount,
        total: gstCalc.total,
        idempotencyKey: options.idempotencyKey || null,
        items: {
          create: lineItems.map((lineItem) => {
            const lineTotal = lineItem.inclusivePrice * lineItem.quantity;
            const gstMultiplier = 1 + lineItem.gstRate / 100;
            const basePrice = lineTotal / gstMultiplier;
            return {
              itemId: lineItem.itemId,
              itemName: lineItem.name,
              quantity: lineItem.quantity,
              unitPrice: Math.round(lineItem.inclusivePrice * 100) / 100,
              totalPrice: Math.round(lineTotal * 100) / 100,
              basePrice: Math.round((basePrice / lineItem.quantity) * 100) / 100,
              baseTotal: Math.round(basePrice * 100) / 100,
              gstRate: lineItem.gstRate,
            };
          }),
        },
      },
      include: { items: true },
    });

    return { order, lineItems };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
}

export async function createPendingOrder(
  storeId: string,
  customerPhone: string,
  customerName: string | undefined,
  customerMessage: string | undefined,
  cartItems: CartItem[],
  idempotencyKey: string
) {
  const { order, lineItems } = await createOrderWithStock(
    storeId,
    customerPhone,
    customerName,
    customerMessage,
    cartItems,
    { paymentStatus: 'PENDING', paymentMethod: 'ONLINE', idempotencyKey }
  );

  const gstCalc = calculateGstFromInclusive(
    lineItems.map((lineItem) => ({
      inclusivePrice: lineItem.inclusivePrice,
      quantity: lineItem.quantity,
      gstRate: lineItem.gstRate,
    }))
  );

  let gatewayOrder;
  try {
    gatewayOrder = await createPaymentOrder(
      Math.round(gstCalc.total * 100),
      order.orderNo,
      { orderId: order.id, storeId, redirectUrl: `${env.FRONTEND_ORIGIN || 'http://localhost:3000'}/checkout?gateway=phonepe&orderId=${order.id}&token=${order.customerAccessToken}` }
    );
  } catch {
    await failOrder(order.id);
    throw new Error('Payment gateway error. Please try again.');
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { razorpayOrderId: gatewayOrder.id },
  });

  return {
    order,
    razorpayOrderId: gatewayOrder.id,
    redirectUrl: (gatewayOrder as any).redirectUrl || undefined,
    amount: Math.round(gstCalc.total * 100),
    lineItems,
  };
}

/** Creates a paid instore order without invoking an online payment gateway. */
export async function createInstoreOrder(
  storeId: string,
  customerPhone: string,
  customerName: string | undefined,
  customerMessage: string | undefined,
  cartItems: CartItem[],
  createdByAdminId: string
) {
  const { order } = await createOrderWithStock(
    storeId,
    customerPhone,
    customerName,
    customerMessage,
    cartItems,
    {
      paymentStatus: 'PAID',
      paymentMethod: 'INSTORE',
      createdByAdminId,
    }
  );

  return order;
}

/**
 * Marks only a still-pending order as paid. An expired/failed order must be
 * reconciled manually; accepting it here would create a paid order whose stock
 * was already returned.
 */
export async function markOrderPaid(razorpayOrderId: string, razorpayPaymentId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { razorpayOrderId },
      include: { store: true },
    });
    if (!order) throw new Error('Order not found');
    if (order.paymentStatus === 'PAID') return { order, shouldSendSms: false };
    if (order.paymentStatus !== 'PENDING') {
      throw new Error('Order is no longer pending payment and requires reconciliation.');
    }

    const updated = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: 'PENDING' },
      data: {
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
        razorpayPaymentId,
      },
    });

    if (updated.count !== 1) {
      const current = await tx.order.findUnique({ where: { id: order.id }, include: { store: true } });
      if (current?.paymentStatus === 'PAID') return { order: current, shouldSendSms: false };
      throw new Error('Order payment state changed and requires reconciliation.');
    }

    const paidOrder = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { store: true },
    });
    return { order: paidOrder, shouldSendSms: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  // Never hold a database transaction open while calling the SMS provider.
  if (result.shouldSendSms) {
    await sendOrderSms(
      result.order.customerPhone,
      result.order.orderNo,
      result.order.store.name,
      result.order.total.toNumber()
    );
  }

  return result.order;
}

export async function failOrder(orderIdOrRazorpayId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: {
        OR: [{ id: orderIdOrRazorpayId }, { razorpayOrderId: orderIdOrRazorpayId }],
      },
      include: { items: true },
    });
    if (!order || order.paymentStatus !== 'PENDING') return order;

    // Move state first. Only the caller that wins PENDING -> FAILED is allowed
    // to return inventory.
    const transitioned = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: 'PENDING' },
      data: { paymentStatus: 'FAILED' },
    });
    if (transitioned.count !== 1) {
      return tx.order.findUnique({ where: { id: order.id } });
    }

    for (const orderItem of order.items) {
      await tx.item.update({
        where: { id: orderItem.itemId },
        data: { stock: { increment: orderItem.quantity } },
      });
    }

    return tx.order.findUnique({ where: { id: order.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function expireOldPendingOrders() {
  const expiry = new Date(Date.now() - 15 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: { paymentStatus: 'PENDING', createdAt: { lt: expiry } },
    select: { id: true, razorpayOrderId: true },
    take: 100,
  });

  for (const order of orders) {
    await failOrder(order.razorpayOrderId || order.id);
  }

  return orders.length;
}
