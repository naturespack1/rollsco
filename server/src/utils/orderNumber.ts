import crypto from 'crypto';
import { Prisma } from '@prisma/client';

const BUSINESS_TIME_ZONE = 'Asia/Kolkata';

function getBusinessDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    displayDate: `${values.year.slice(2)}${values.month}${values.day}`,
  };
}

/**
 * Generates an atomic, customer-facing order number in the format
 * R-YYMMDD-XXXX-XXXX. The first four digits are freshly random for every
 * order; the final four digits are an atomic sequence for that business day.
 */
export async function generateOrderNumber(tx: Prisma.TransactionClient, now = new Date()): Promise<string> {
  const { dateKey, displayDate } = getBusinessDateParts(now);
  const randomPart = crypto.randomInt(1000, 10000).toString();

  const sequence = await tx.dailyOrderSequence.upsert({
    where: { dateKey },
    create: { dateKey, nextValue: 1 },
    update: { nextValue: { increment: 1 } },
    select: { nextValue: true },
  });
  if (sequence.nextValue > 9999) {
    throw new Error('Daily order sequence limit reached.');
  }

  return `R-${displayDate}-${randomPart}-${String(sequence.nextValue).padStart(4, '0')}`;
}
