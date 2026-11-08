import { serverErrorMessage } from '@nearbuy/shared';

export type ActionState = { error?: string; ok?: string } | null;

/** Admin-facing error text: mapped NB_ codes, otherwise the raw database message. */
export function errorText(error: { message: string } | null | undefined): string {
  if (!error) return 'Something went wrong';
  return /NB_[A-Z_]+/.test(error.message) ? serverErrorMessage(error.message) : error.message;
}

export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export function int(form: FormData, key: string): number | null {
  const s = str(form, key);
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function bool(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === 'on' || v === 'true' || v === '1';
}
