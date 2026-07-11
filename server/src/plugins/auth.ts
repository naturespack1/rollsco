import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config';

declare module 'fastify' {
  interface FastifyRequest {
    admin?: { id: string; email: string; role: string; storeIds: string[] };
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new Error('No token');
    const payload = await request.jwtVerify<{ id: string; email: string; role: string }>();

    const { prisma } = await import('../prismaClient');
    const adminStores = await prisma.adminStore.findMany({
      where: { adminId: payload.id },
      select: { storeId: true },
    });

    request.admin = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      storeIds: adminStores.map((s) => s.storeId),
    };
  } catch (err) {
    reply.status(401).send({ success: false, error: 'Unauthorized' });
    return reply;
  }
}

export async function authPlugin() {
  // Plugin is no longer needed for decoration, but kept for Fastify lifecycle
  // Routes now import authenticate directly
}
