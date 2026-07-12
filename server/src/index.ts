import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import rawBody from 'fastify-raw-body';
import { env } from './config';
import { prisma } from './prismaClient';
import { errorHandler } from './plugins/errorHandler';
import { authPlugin } from './plugins/auth';
import { expireOldPendingOrders } from './services/orderService';
import { reconcilePendingPayments } from './services/paymentReconciliation';
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

app.register(helmet, {
  global: true,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  },
  referrerPolicy: { policy: 'no-referrer' },
});
app.register(cors, {
  origin: env.FRONTEND_ORIGIN || false,
  credentials: false,
});
app.register(rateLimit, {
  global: false,
  max: 100,
  timeWindow: '1 minute',
});
app.register(rawBody, { field: 'rawBody', global: false, encoding: false, runFirst: true });
app.register(jwt, { secret: env.JWT_SECRET });
app.register(errorHandler);
app.register(authPlugin);

app.register(storeRoutes, { prefix: '/api/stores' });
app.register(menuRoutes, { prefix: '/api/menu' });
app.register(orderRoutes, { prefix: '/api/orders' });
app.register(webhookRoutes, { prefix: '/api/webhooks' });
app.register(adminAuthRoutes, { prefix: '/api/admin/auth' });
app.register(adminDashboardRoutes, { prefix: '/api/admin' });

let orderMaintenanceRunning = false;
const runOrderMaintenance = async () => {
  if (orderMaintenanceRunning) return;
  orderMaintenanceRunning = true;
  try {
    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      // Reconcile first so a captured payment is not expired and restocked
      // before the provider status has been checked.
      const reconciliation = await reconcilePendingPayments();
      const expired = await expireOldPendingOrders();
      app.log.info({ expired, reconciliation }, 'Order maintenance completed');
    } else {
      const expired = await expireOldPendingOrders();
      app.log.info({ expired }, 'Order expiry completed');
    }
  } catch (error) {
    app.log.error(error, 'Order maintenance failed');
  } finally {
    orderMaintenanceRunning = false;
  }
};

const maintenanceTimer = setInterval(() => { void runOrderMaintenance(); }, 5 * 60 * 1000);
app.addHook('onClose', async () => clearInterval(maintenanceTimer));

app.get('/health', async () => ({ status: 'ok' }));

const start = async () => {
  try {
    await app.listen({ port: Number(env.PORT), host: '0.0.0.0' });
    void runOrderMaintenance();
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
