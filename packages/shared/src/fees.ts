import { assertRupees, sumLines, type PricedLine } from './money';

export interface FeeSettings {
  delivery_fee: number;
  free_delivery_over: number | null;
  /** YYYY-MM-DD, inclusive. null = no end date. */
  free_delivery_until: string | null;
  min_order_amount: number;
}

/** Rule 4. `today` is the Colombo date as YYYY-MM-DD. */
export function computeDeliveryFee(
  itemsTotal: number,
  settings: FeeSettings,
  today: string,
): number {
  assertRupees(itemsTotal);
  const { free_delivery_over, free_delivery_until } = settings;
  const freeActive =
    free_delivery_over !== null &&
    itemsTotal >= free_delivery_over &&
    (free_delivery_until === null || today <= free_delivery_until);
  return freeActive ? 0 : settings.delivery_fee;
}

export interface CartTotals {
  itemsTotal: number;
  deliveryFee: number;
  total: number;
  meetsMinimum: boolean;
  /** Rupees still needed to reach the minimum order (0 if met). */
  shortBy: number;
}

/** Rules 4–6 for display in the cart. The server recomputes everything at place_order. */
export function computeCartTotals(
  lines: readonly PricedLine[],
  settings: FeeSettings,
  today: string,
): CartTotals {
  const itemsTotal = sumLines(lines);
  const deliveryFee = computeDeliveryFee(itemsTotal, settings, today);
  const meetsMinimum = itemsTotal >= settings.min_order_amount;
  return {
    itemsTotal,
    deliveryFee,
    total: itemsTotal + deliveryFee,
    meetsMinimum,
    shortBy: meetsMinimum ? 0 : settings.min_order_amount - itemsTotal,
  };
}

export interface EarningsInput {
  items_selling_total: number;
  items_shop_total: number;
  delivery_fee: number;
  rider_pay: number;
}

/** Our earnings for a delivered order: selling − shop + fee − rider pay. */
export function orderEarnings(o: EarningsInput): number {
  return o.items_selling_total - o.items_shop_total + o.delivery_fee - o.rider_pay;
}
