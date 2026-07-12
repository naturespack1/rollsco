import { prisma } from '../prismaClient';
import { fetchOrderPayments, recordPaymentEvent } from './paymentService';
import { markOrderPaid } from './orderService';

/**
 * Reconciles pending Razorpay orders in case a client verification or webhook
 * was missed. This job is idempotent because markOrderPaid only accepts PENDING
 * orders and payment events are deduplicated by payment ID.
 */
export async function reconcilePendingPayments() {
  const pendingOrders = await prisma.order.findMany({
    where: {
      paymentStatus: 'PENDING',
      razorpayOrderId: { not: null },
      createdAt: { lt: new Date(Date.now() - 60 * 1000) },
    },
    select: { id: true, razorpayOrderId: true },
    take: 100,
    orderBy: { createdAt: 'asc' },
  });

  let reconciled = 0;
  let failures = 0;

  for (const order of pendingOrders) {
    try {
      const payments: any = await fetchOrderPayments(order.razorpayOrderId!);
      const capturedPayment = payments.items?.find((payment: any) => payment.status === 'captured');
      if (!capturedPayment) continue;

      const paidOrder = await markOrderPaid(order.razorpayOrderId!, capturedPayment.id);
      await recordPaymentEvent({
        dedupeKey: `reconcile:${capturedPayment.id}`,
        eventType: 'reconciliation.payment_captured',
        razorpayOrderId: order.razorpayOrderId!,
        razorpayPaymentId: capturedPayment.id,
        orderId: paidOrder.id,
        payload: { source: 'scheduled_reconciliation', payment: capturedPayment },
      });
      reconciled += 1;
    } catch {
      failures += 1;
    }
  }

  return { scanned: pendingOrders.length, reconciled, failures };
}
