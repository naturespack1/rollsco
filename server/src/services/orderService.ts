import { prisma } from '../prismaClient';
import { calculateGstFromInclusive } from '../utils/gstCalc';
import { generateOrderNumber } from '../utils/orderNumber';
import { createRazorpayOrder } from './paymentService';
import { sendOrderSms } from './smsService';

interface CartItem {
  id: string;
  quantity: number;
}

export async function createPendingOrder(
  storeId: string,
  customerPhone: string,
  customerName: string | undefined,
  customerMessage: string | undefined,
  cartItems: CartItem[]
) {
  // 1. DB Transaction: validate, lock stock, create order
  const { order, lineItems } = await prisma.$transaction(async (tx) => {
    const itemIds = cartItems.map((c) => c.id);

    const items = await tx.item.findMany({
      where: { id: { in: itemIds }, storeId },
    });

    const itemMap = new Map(items.map((i) => [i.id, i]));

    const lineItems: {
      name: string;
      inclusivePrice: number;
      quantity: number;
      gstRate: number;
      itemId: string;
    }[] = [];

    for (const cartItem of cartItems) {
      const item = itemMap.get(cartItem.id);
      if (!item) throw new Error(`Item not found: ${cartItem.id}`);
      if (item.stock < cartItem.quantity) throw new Error(`${item.name} is out of stock. Only ${item.stock} left.`);

      lineItems.push({
        name: item.name,
        inclusivePrice: item.price.toNumber(), // GST-inclusive menu price
        quantity: cartItem.quantity,
        gstRate: item.gstRate.toNumber(),
        itemId: item.id,
      });
    }

    // Deduct stock
    for (const cartItem of cartItems) {
      await tx.item.update({
        where: { id: cartItem.id },
        data: { stock: { decrement: cartItem.quantity } },
      });
    }

    const gstCalc = calculateGstFromInclusive(
      lineItems.map((li) => ({
        inclusivePrice: li.inclusivePrice,
        quantity: li.quantity,
        gstRate: li.gstRate,
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
        paymentStatus: 'PENDING',
        subtotal: gstCalc.subtotal, // base price total (before tax)
        cgstAmount: gstCalc.cgstAmount,
        sgstAmount: gstCalc.sgstAmount,
        total: gstCalc.total, // sum of menu prices (what customer pays)
        idempotencyKey: `${orderNo}-${Date.now()}`,
        items: {
          create: lineItems.map((li) => {
            const lineTotal = li.inclusivePrice * li.quantity;
            const gstMultiplier = 1 + li.gstRate / 100;
            const basePrice = lineTotal / gstMultiplier;
            return {
              itemId: li.itemId,
              itemName: li.name,
              quantity: li.quantity,
              unitPrice: Math.round(li.inclusivePrice * 100) / 100, // Inclusive price per unit (menu price)
              totalPrice: Math.round(lineTotal * 100) / 100, // Inclusive total for this line
              basePrice: Math.round(basePrice / li.quantity * 100) / 100, // Base price per unit
              baseTotal: Math.round(basePrice * 100) / 100, // Base total for this line
              gstRate: li.gstRate,
            };
          }),
        },
      },
    });

    return { order, lineItems };
  }, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 10000 });

  // 2. Create Razorpay order (outside DB transaction to avoid holding locks)
  const gstCalc = calculateGstFromInclusive(
    lineItems.map((li) => ({
      inclusivePrice: li.inclusivePrice,
      quantity: li.quantity,
      gstRate: li.gstRate,
    }))
  );
  let razorpayOrder;
  try {
    razorpayOrder = await createRazorpayOrder(
      Math.round(gstCalc.total * 100), // amount in paise (inclusive total)
      order.orderNo,
      { orderId: order.id, storeId }
    );
  } catch (err) {
    // If Razorpay fails, restore stock and delete the pending order
    await failOrder(order.id);
    throw new Error('Payment gateway error. Please try again.');
  }

  // 3. Update order with Razorpay order ID
  await prisma.order.update({
    where: { id: order.id },
    data: { razorpayOrderId: razorpayOrder.id },
  });

  return { order, razorpayOrderId: razorpayOrder.id, amount: Math.round(gstCalc.total * 100), lineItems };
}

export async function markOrderPaid(razorpayOrderId: string, razorpayPaymentId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { razorpayOrderId },
      include: { store: true },
    });
    if (!order) throw new Error('Order not found');
    if (order.paymentStatus === 'PAID') return order; // Idempotent

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'PAID', razorpayPaymentId },
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

    // Restore stock
    for (const oi of order.items) {
      await tx.item.update({
        where: { id: oi.itemId },
        data: { stock: { increment: oi.quantity } },
      });
    }

    return tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: 'FAILED' },
    });
  });
}

export async function expireOldPendingOrders() {
  const expiry = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes
  const orders = await prisma.order.findMany({
    where: { paymentStatus: 'PENDING', createdAt: { lt: expiry } },
  });

  for (const order of orders) {
    await failOrder(order.razorpayOrderId || order.id);
  }
}
