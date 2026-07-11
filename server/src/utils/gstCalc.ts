import { Decimal } from '@prisma/client/runtime/library';

export interface GstBreakdown {
  subtotal: number;      // base price before tax (sum of reverse-calculated base prices)
  cgstAmount: number;    // CGST = gstAmount / 2
  sgstAmount: number;    // SGST = gstAmount / 2
  total: number;         // sum of inclusive prices (what customer pays)
}

/**
 * Prices are GST-inclusive (menu price = final customer price).
 * Reverse-calculate base price and tax breakdown.
 * 
 * Example: inclusivePrice=120, gstRate=5
 * basePrice = 120 / 1.05 = 114.2857
 * gstAmount = 120 - 114.2857 = 5.7143
 * cgst = 2.8571, sgst = 2.8571
 * total = 120
 */
export function calculateGstFromInclusive(items: { inclusivePrice: number; quantity: number; gstRate: number }[]): GstBreakdown {
  let subtotal = 0;      // sum of base prices (before tax)
  let cgstAmount = 0;
  let sgstAmount = 0;
  let total = 0;         // sum of inclusive prices (what customer pays)

  for (const item of items) {
    const lineTotal = item.inclusivePrice * item.quantity;
    const gstMultiplier = 1 + (item.gstRate / 100);
    const lineBase = lineTotal / gstMultiplier;   // reverse-calculate base price
    const lineGst = lineTotal - lineBase;         // total tax for this line

    subtotal += lineBase;
    cgstAmount += lineGst / 2;
    sgstAmount += lineGst / 2;
    total += lineTotal;
  }

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    cgstAmount: Math.round(cgstAmount * 100) / 100,
    sgstAmount: Math.round(sgstAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
