import { prisma } from '../prismaClient';

export async function generateOrderNumber(): Promise<string> {
  const date = new Date();
  const dateStr = date.toISOString().slice(2, 10).replace(/-/g, ''); // YYMMDD

  const count = await prisma.order.count({
    where: {
      createdAt: {
        gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
      },
    },
  });

  const seq = String(count + 1).padStart(3, '0');
  return `R-${dateStr}-${seq}`;
}
