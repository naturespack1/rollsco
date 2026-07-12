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
  FRONTEND_ORIGIN: requiredInProduction('FRONTEND_ORIGIN'),
};
