import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../prismaClient';
import { authenticate } from '../plugins/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function adminAuthRoutes(app: FastifyInstance) {
  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const admin = await prisma.adminUser.findUnique({
      where: { email: body.email },
      include: { stores: { select: { storeId: true } } },
    });

    if (!admin) {
      return reply.status(401).send({ success: false, error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(body.password, admin.passwordHash);
    if (!valid) {
      return reply.status(401).send({ success: false, error: 'Invalid credentials' });
    }

    const token = await reply.jwtSign({
      id: admin.id,
      email: admin.email,
      role: admin.role,
    }, { expiresIn: '7d' });

    return {
      success: true,
      data: {
        token,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
          storeIds: admin.stores.map((s) => s.storeId),
        },
      },
    };
  });

  app.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    return { success: true, data: request.admin };
  });
}
