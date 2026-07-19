const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

function requiredInProduction(name: string, fallback = '') {
  const value = process.env[name] || fallback;
  if (isProduction && !value) {
    throw new Error(`Missing required production environment variable: ${name}`);
  }
  return value;
}

const jwtSecret = requiredInProduction('JWT_SECRET', isProduction ? '' : 'dev-secret-change-me');
if (isProduction && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}

export const env = {
  NODE_ENV,
  PORT: process.env.PORT || '3000',
  DATABASE_URL: requiredInProduction('DATABASE_URL', isProduction ? '' : 'postgresql://postgres:postgres@localhost:5432/quickbite?schema=public'),
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  JWT_SECRET: jwtSecret,
  MSG91_AUTHKEY: process.env.MSG91_AUTHKEY || '',
  MSG91_SENDERID: process.env.MSG91_SENDERID || 'QUICKB',
  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID || 'order_confirmation',
  ADMIN_DEFAULT_EMAIL: process.env.ADMIN_DEFAULT_EMAIL || '',
  ADMIN_DEFAULT_PASSWORD: process.env.ADMIN_DEFAULT_PASSWORD || '',
  // Optional at startup so a missing CORS configuration cannot take down every
  // API route. Set this in production to the deployed frontend origin(s).
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || '',
  PAYMENT_GATEWAY: (process.env.PAYMENT_GATEWAY === 'razorpay' || process.env.PAYMENT_GATEWAY === 'phonepe') ? process.env.PAYMENT_GATEWAY : 'razorpay',
  PHONEPE_CLIENT_ID: process.env.PHONEPE_CLIENT_ID || '',
  PHONEPE_CLIENT_SECRET: process.env.PHONEPE_CLIENT_SECRET || '',
  PHONEPE_CLIENT_VERSION: parseInt(process.env.PHONEPE_CLIENT_VERSION || '1', 10),
  PHONEPE_ENV: process.env.PHONEPE_ENV || 'SANDBOX',
  PHONEPE_SALT_KEY: process.env.PHONEPE_SALT_KEY || '',
  PHONEPE_SALT_INDEX: process.env.PHONEPE_SALT_INDEX || '1',
};
