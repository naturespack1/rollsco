import { FastifyInstance } from 'fastify';
import { prisma } from '../prismaClient';

export default async function storeRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const stores = await prisma.store.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        isOpen: true,
        acceptingOrders: true,
      },
      orderBy: [{ isOpen: 'desc' }, { acceptingOrders: 'desc' }, { name: 'asc' }],
    });
    const sorted = [...stores].sort((a, b) => {
      const aOpen = a.isOpen && a.acceptingOrders ? 0 : 1;
      const bOpen = b.isOpen && b.acceptingOrders ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      return a.name.localeCompare(b.name);
    });
    return { success: true, data: sorted };
  });
}
