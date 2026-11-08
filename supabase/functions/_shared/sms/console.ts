import type { SmsProvider, SmsSendResult } from './types.ts';

/** Development provider: prints messages to the Edge Function logs instead of sending them. */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';

  send(to: string, body: string): Promise<SmsSendResult> {
    console.log(`[sms:console] to=${to} body=${JSON.stringify(body)}`);
    return Promise.resolve({ ok: true, providerMessageId: `console-${crypto.randomUUID()}` });
  }
}
