/**
 * Sri Lankan mobile numbers: +94 7X XXX XXXX.
 * Accepts "0771234567", "771234567", "94771234567", "+94 77 123 4567", "077-123-4567".
 */
const SL_MOBILE_E164 = /^\+947\d{8}$/;

export function normalizeSriLankanMobile(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;

  let national: string;
  if (digits.startsWith('94')) national = digits.slice(2);
  else if (digits.startsWith('0')) national = digits.slice(1);
  else national = digits;

  const e164 = `+94${national}`;
  return SL_MOBILE_E164.test(e164) ? e164 : null;
}

export function isSriLankanMobile(e164: string): boolean {
  return SL_MOBILE_E164.test(e164);
}

/** "+94771234567" → "+94 77 123 4567" */
export function formatSriLankanMobile(e164: string): string {
  if (!isSriLankanMobile(e164)) return e164;
  return `+94 ${e164.slice(3, 5)} ${e164.slice(5, 8)} ${e164.slice(8)}`;
}
