import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { env } from './config';
import { prisma } from './prismaClient';
import { errorHandler } from './plugins/errorHandler';
import { authPlugin } from './plugins/auth';
import storeRoutes from './routes/store';
import menuRoutes from './routes/menu';
import orderRoutes from './routes/order';
import webhookRoutes from './routes/webhook';
import adminAuthRoutes from './routes/adminAuth';
import adminDashboardRoutes from './routes/adminDashboard';

const app = Fastify({
  logger: { level: 'info' },
  trustProxy: true,
});

app.register(cors, { origin: true, credentials: true });
app.register(jwt, { secret: env.JWT_SECRET });
app.register(errorHandler);
app.register(authPlugin);

app.register(storeRoutes, { prefix: '/api/stores' });
app.register(menuRoutes, { prefix: '/api/menu' });
app.register(orderRoutes, { prefix: '/api/orders' });
app.register(webhookRoutes, { prefix: '/api/webhooks' });
app.register(adminAuthRoutes, { prefix: '/api/admin/auth' });
app.register(adminDashboardRoutes, { prefix: '/api/admin' });

app.get('/health', async () => ({ status: 'ok' }));

const start = async () => {
  try {
    await app.listen({ port: Number(env.PORT), host: '0.0.0.0' });
    app.log.info(`Server running on http://localhost:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

process.on('SIGTERM', async () => {
  await app.close();
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await app.close();
  await prisma.$disconnect();
});
