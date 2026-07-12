import { prisma } from '../prismaClient';
import { calculateGstFromInclusive } from '../utils/gstCalc';
import { generateOrderNumber } from '../utils/orderNumber';
import { createRazorpayOrder } from './paymentService';
import { sendOrderSms } from './smsService';

interface CartItem {
  id: string;
  quantity: number;
}

interface OrderCreationOptions {
  paymentStatus: 'PENDING' | 'PAID';
  paymentMethod: 'ONLINE' | 'INSTORE';
}

interface LineItem {
  name: string;
  inclusivePrice: number;
  quantity: number;
  gstRate: number;
  itemId: string;
}

/**
 * Validates the cart, deducts stock, and persists an order atomically.
 * Payment processing is intentionally left to the caller so both online and
 * instore orders use the same stock and GST calculations.
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
    // Merge repeated item IDs before validating stock. This protects the API
    // even if a caller bypasses the client-side cart's one-line-per-item rule.
    const quantitiesByItemId = new Map<string, number>();
    for (const cartItem of cartItems) {
      quantitiesByItemId.set(
        cartItem.id,
        (quantitiesByItemId.get(cartItem.id) || 0) + cartItem.quantity
      );
    }
    const normalizedCartItems = Array.from(quantitiesByItemId, ([id, quantity]) => ({ id, quantity }));
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

    for (const cartItem of normalizedCartItems) {
      await tx.item.update({
        where: { id: cartItem.id },
        data: { stock: { decrement: cartItem.quantity } },
      });
    }

    const gstCalc = calculateGstFromInclusive(
      lineItems.map((lineItem) => ({
        inclusivePrice: lineItem.inclusivePrice,
        quantity: lineItem.quantity,
        gstRate: lineItem.gstRate,
      }))
    );
    const orderNo = await generateOrderNumber();

    const order = await tx.order.create({
      data: {
        orderNo,
        storeId,
        customerPhone,
        customerName: customerName || null,
        customerMessage: customerMessage || null,
        status: 'CREATED',
        paymentStatus: options.paymentStatus,
        paymentMethod: options.paymentMethod,
        subtotal: gstCalc.subtotal,
        cgstAmount: gstCalc.cgstAmount,
        sgstAmount: gstCalc.sgstAmount,
        total: gstCalc.total,
        idempotencyKey: `${orderNo}-${Date.now()}`,
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
  }, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 10000 });
}

export async function createPendingOrder(
  storeId: string,
  customerPhone: string,
  customerName: string | undefined,
  customerMessage: string | undefined,
  cartItems: CartItem[]
) {
  // 1. DB transaction: validate cart, reserve stock, and create the pending online order.
  const { order, lineItems } = await createOrderWithStock(
    storeId,
    customerPhone,
    customerName,
    customerMessage,
    cartItems,
    { paymentStatus: 'PENDING', paymentMethod: 'ONLINE' }
  );

  // 2. Create the Razorpay order outside the DB transaction to avoid holding locks.
  const gstCalc = calculateGstFromInclusive(
    lineItems.map((lineItem) => ({
      inclusivePrice: lineItem.inclusivePrice,
      quantity: lineItem.quantity,
      gstRate: lineItem.gstRate,
    }))
  );

  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder(
      Math.round(gstCalc.total * 100),
      order.orderNo,
      { orderId: order.id, storeId }
    );
  } catch (err) {
    // If Razorpay fails, restore stock and mark the pending order as failed.
    await failOrder(order.id);
    throw new Error('Payment gateway error. Please try again.');
  }

  // 3. Store the payment gateway order ID for later verification.
  await prisma.order.update({
    where: { id: order.id },
    data: { razorpayOrderId: razorpayOrder.id },
  });

  return {
    order,
    razorpayOrderId: razorpayOrder.id,
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
  cartItems: CartItem[]
) {
  const { order } = await createOrderWithStock(
    storeId,
    customerPhone,
    customerName,
    customerMessage,
    cartItems,
    { paymentStatus: 'PAID', paymentMethod: 'INSTORE' }
  );

  return order;
}

export async function markOrderPaid(razorpayOrderId: string, razorpayPaymentId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { razorpayOrderId },
      include: { store: true },
    });
    if (!order) throw new Error('Order not found');
    if (order.paymentStatus === 'PAID') return order;

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'PAID', paymentMethod: 'ONLINE', razorpayPaymentId },
    });

    await sendOrderSms(order.customerPhone, order.orderNo, order.store.name, order.total.toNumber());
    return updated;
  });
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

    for (const orderItem of order.items) {
      await tx.item.update({
        where: { id: orderItem.itemId },
        data: { stock: { increment: orderItem.quantity } },
      });
    }

    return tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'FAILED' },
    });
  });
}

export async function expireOldPendingOrders() {
  const expiry = new Date(Date.now() - 15 * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: { paymentStatus: 'PENDING', createdAt: { lt: expiry } },
  });

  for (const order of orders) {
    await failOrder(order.razorpayOrderId || order.id);
  }
}
