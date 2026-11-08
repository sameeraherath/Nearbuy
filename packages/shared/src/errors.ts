import { SERVER_ERRORS, type ServerErrorCode } from './constants';
import { formatRs } from './money';

/**
 * Postgres functions raise `NB_CODE` or `NB_CODE:detail` (e.g. `NB_MIN_ORDER:300`).
 * Turns a Supabase/PostgREST error message into user-facing text.
 */
export function serverErrorMessage(message: string | undefined | null): string {
  if (!message) return 'Something went wrong. Please try again.';
  const match = /(NB_[A-Z_]+)(?::(\S+))?/.exec(message);
  if (!match) return 'Something went wrong. Please try again.';
  const code = match[1] as ServerErrorCode;
  const detail = match[2];
  const text: string | undefined = SERVER_ERRORS[code];
  if (!text) return 'Something went wrong. Please try again.';
  if (code === 'NB_MIN_ORDER' && detail) return `Minimum order is ${formatRs(Number(detail))}`;
  return text;
}

/** "Wrong code, 2 tries left" */
export function wrongCodeMessage(attemptsLeft: number): string {
  if (attemptsLeft <= 0) return SERVER_ERRORS.NB_CODE_LOCKED;
  return `Wrong code, ${attemptsLeft} ${attemptsLeft === 1 ? 'try' : 'tries'} left`;
}
