import crypto from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60 * 1000;
const PHONE_LIMIT = 6;
const DEVICE_LIMIT = 12;

function hashedKey(scope: string, value: string) {
  return `${scope}:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function consume(key: string, limit: number) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count <= limit) return { allowed: true, retryAfterSeconds: 0 };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Supplemental per-phone and per-device protection for public checkout.
 * IP limiting is provided by @fastify/rate-limit on the route itself.
 *
 * This in-memory guard is suitable for a single process. Production deployments
 * with multiple instances should replace it with a shared Redis-backed limiter.
 */
export async function checkoutAbuseGuard(request: FastifyRequest, reply: FastifyReply) {
  const body = (request.body || {}) as { customerPhone?: unknown };
  const phone = typeof body.customerPhone === 'string'
    ? body.customerPhone.replace(/[^0-9]/g, '').slice(-15)
    : '';
  const deviceId = getHeaderValue(request.headers['x-device-id']);

  const limits: Array<{ key: string; limit: number }> = [];
  if (phone.length >= 10) limits.push({ key: hashedKey('phone', phone), limit: PHONE_LIMIT });
  if (deviceId && /^[a-zA-Z0-9-]{16,128}$/.test(deviceId)) {
    limits.push({ key: hashedKey('device', deviceId), limit: DEVICE_LIMIT });
  }

  for (const rule of limits) {
    const result = consume(rule.key, rule.limit);
    if (!result.allowed) {
      reply.header('Retry-After', String(result.retryAfterSeconds));
      return reply.status(429).send({
        success: false,
        error: 'Too many checkout attempts. Please wait a minute and try again.',
      });
    }
  }
}
