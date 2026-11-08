// Delivers queued rows from public.sms_messages (order placed, item unavailable,
// picked up, delivered, cancelled). Triggered by pg_net on insert and by a pg_cron sweep.
import { getSmsProvider } from '../_shared/sms/index.ts';
import { json, safeEqual, serviceClient } from '../_shared/supabase.ts';

const BATCH = 20;
const TIME_BUDGET_MS = 20_000;

interface QueuedSms {
  id: string;
  to_phone: string;
  body: string;
}

Deno.serve(async (req) => {
  const expected = Deno.env.get('SMS_DISPATCH_SECRET');
  const given = req.headers.get('x-dispatch-secret') ?? '';
  if (!expected || !safeEqual(given, expected)) return json({ error: 'unauthorized' }, 401);

  const db = serviceClient();
  const provider = getSmsProvider();
  const started = Date.now();
  let sent = 0;
  let failed = 0;

  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data, error } = await db.rpc('sms_claim_batch', { p_limit: BATCH });
    if (error) {
      console.error('[sms-dispatch] claim failed', error.message);
      return json({ error: 'claim failed' }, 500);
    }
    const batch = (data ?? []) as QueuedSms[];
    if (batch.length === 0) break;

    for (const msg of batch) {
      let ok = false;
      let providerMessageId: string | null = null;
      let errorText: string | null = null;
      try {
        const result = await provider.send(msg.to_phone, msg.body);
        ok = result.ok;
        providerMessageId = result.providerMessageId ?? null;
        errorText = result.error ?? null;
      } catch (e) {
        errorText = e instanceof Error ? e.message : String(e);
      }
      if (ok) sent++;
      else failed++;
      const { error: recordError } = await db.rpc('sms_record_result', {
        p_id: msg.id,
        p_ok: ok,
        p_provider: provider.name,
        p_provider_message_id: providerMessageId,
        p_error: errorText,
      });
      if (recordError) console.error('[sms-dispatch] record failed', msg.id, recordError.message);
    }
    if (batch.length < BATCH) break;
  }

  return json({ sent, failed });
});
