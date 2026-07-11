export const env = {
  PORT: process.env.PORT || '3000',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/quickbite?schema=public',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  MSG91_AUTHKEY: process.env.MSG91_AUTHKEY || '',
  MSG91_SENDERID: process.env.MSG91_SENDERID || 'QUICKB',
  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID || 'order_confirmation',
  ADMIN_DEFAULT_EMAIL: process.env.ADMIN_DEFAULT_EMAIL || 'admin@quickbite.com',
  ADMIN_DEFAULT_PASSWORD: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123',
};
