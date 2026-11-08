import { describe, expect, it } from 'vitest';
import { formatRs, sumLines } from '../money';

describe('formatRs', () => {
  it('formats with thousands separators', () => {
    expect(formatRs(2100)).toBe('Rs 2,100');
    expect(formatRs(60)).toBe('Rs 60');
    expect(formatRs(0)).toBe('Rs 0');
    expect(formatRs(1250000)).toBe('Rs 1,250,000');
  });
  it('rejects non-integer or negative amounts', () => {
    expect(() => formatRs(10.5)).toThrow(RangeError);
    expect(() => formatRs(-1)).toThrow(RangeError);
  });
});

describe('sumLines', () => {
  it('sums price × qty and skips unavailable lines', () => {
    expect(
      sumLines([
        { qty: 2, price: 850 },
        { qty: 3, price: 650 },
        { qty: 1, price: 1100, isUnavailable: true },
      ]),
    ).toBe(3650);
  });
  it('returns 0 for an empty list', () => {
    expect(sumLines([])).toBe(0);
  });
  it('rejects fractional quantities', () => {
    expect(() => sumLines([{ qty: 1.5, price: 100 }])).toThrow(RangeError);
  });
});
