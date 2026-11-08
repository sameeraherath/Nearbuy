/** All money is integer LKR rupees. */

export function assertRupees(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`Money must be a non-negative integer number of rupees, got ${value}`);
  }
}

/** 2100 → "Rs 2,100" */
export function formatRs(amount: number): string {
  assertRupees(amount);
  return `Rs ${amount.toLocaleString('en-US')}`;
}

export interface PricedLine {
  qty: number;
  price: number;
  isUnavailable?: boolean;
}

/** Sum of price × qty for available lines. */
export function sumLines(lines: readonly PricedLine[]): number {
  let total = 0;
  for (const line of lines) {
    if (line.isUnavailable) continue;
    if (!Number.isSafeInteger(line.qty) || line.qty < 0) {
      throw new RangeError(`Quantity must be a non-negative integer, got ${line.qty}`);
    }
    assertRupees(line.price);
    total += line.price * line.qty;
  }
  return total;
}
