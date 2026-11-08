import { ConsoleSmsProvider } from './console.ts';
import type { SmsProvider } from './types.ts';

export type { SmsProvider, SmsSendResult } from './types.ts';

/**
 * Picks the provider from the SMS_PROVIDER env var.
 *   console (default) — logs only, for development
 *   textlk            — Text.lk (Phase 6)
 * To add Notify.lk or Dialog, implement SmsProvider and add a case here.
 */
export function getSmsProvider(): SmsProvider {
  const name = (Deno.env.get('SMS_PROVIDER') ?? 'console').trim().toLowerCase();
  switch (name) {
    case '':
    case 'console':
      return new ConsoleSmsProvider();
    default:
      throw new Error(`Unknown SMS_PROVIDER "${name}". Supported: console`);
  }
}

/** Sri Lankan mobile in E.164 (+947XXXXXXXX). Mirrors @nearbuy/shared isSriLankanMobile. */
export function isSriLankanMobile(phone: string): boolean {
  return /^\+947\d{8}$/.test(phone);
}
