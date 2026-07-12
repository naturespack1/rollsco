import { describe, expect, it } from 'vitest';
import { calculateGstFromInclusive } from './gstCalc';

describe('calculateGstFromInclusive', () => {
  it('splits inclusive GST evenly between CGST and SGST', () => {
    const result = calculateGstFromInclusive([
      { inclusivePrice: 120, quantity: 1, gstRate: 5 },
      { inclusivePrice: 90, quantity: 2, gstRate: 12 },
    ]);

    expect(result.total).toBe(300);
    expect(result.subtotal + result.cgstAmount + result.sgstAmount).toBeCloseTo(300, 2);
    expect(result.cgstAmount).toBe(result.sgstAmount);
  });

  it('keeps zero-rated items tax-free', () => {
    expect(calculateGstFromInclusive([
      { inclusivePrice: 50, quantity: 2, gstRate: 0 },
    ])).toEqual({
      subtotal: 100,
      cgstAmount: 0,
      sgstAmount: 0,
      total: 100,
    });
  });
});
