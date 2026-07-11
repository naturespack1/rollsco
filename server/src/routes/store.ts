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
    });
    return { success: true, data: stores };
  });
}
