import { describe, expect, it } from 'vitest';
import { computeCartTotals, computeDeliveryFee, orderEarnings, type FeeSettings } from '../fees';

const base: FeeSettings = {
  delivery_fee: 100,
  free_delivery_over: null,
  free_delivery_until: null,
  min_order_amount: 300,
};
const today = '2026-11-08';

describe('computeDeliveryFee', () => {
  it('charges the standard fee when no promo is set', () => {
    expect(computeDeliveryFee(5000, base, today)).toBe(100);
  });
  it('is free at or above the threshold', () => {
    const s = { ...base, free_delivery_over: 1500, free_delivery_until: '2026-11-30' };
    expect(computeDeliveryFee(1500, s, today)).toBe(0);
    expect(computeDeliveryFee(1499, s, today)).toBe(100);
  });
  it('is free on the last day and charged the day after', () => {
    const s = { ...base, free_delivery_over: 1000, free_delivery_until: '2026-11-08' };
    expect(computeDeliveryFee(1000, s, '2026-11-08')).toBe(0);
    expect(computeDeliveryFee(1000, s, '2026-11-09')).toBe(100);
  });
  it('treats a null until-date as no expiry', () => {
    const s = { ...base, free_delivery_over: 1000 };
    expect(computeDeliveryFee(1000, s, '2030-01-01')).toBe(0);
  });
});

describe('computeCartTotals', () => {
  it('adds the fee to the items total', () => {
    const t = computeCartTotals(
      [
        { qty: 2, price: 850 },
        { qty: 1, price: 400 },
      ],
      base,
      today,
    );
    expect(t).toEqual({
      itemsTotal: 2100,
      deliveryFee: 100,
      total: 2200,
      meetsMinimum: true,
      shortBy: 0,
    });
  });
  it('flags orders below the minimum', () => {
    const t = computeCartTotals([{ qty: 2, price: 120 }], base, today);
    expect(t.meetsMinimum).toBe(false);
    expect(t.shortBy).toBe(60);
  });
  it('accepts an order exactly at the minimum', () => {
    expect(computeCartTotals([{ qty: 5, price: 60 }], base, today).meetsMinimum).toBe(true);
  });
});

describe('orderEarnings', () => {
  it('is selling − shop + fee − rider pay', () => {
    expect(
      orderEarnings({
        items_selling_total: 2100,
        items_shop_total: 1970,
        delivery_fee: 100,
        rider_pay: 60,
      }),
    ).toBe(170);
  });
});
