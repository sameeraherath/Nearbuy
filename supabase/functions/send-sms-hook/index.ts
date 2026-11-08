// Supabase Auth "Send SMS" hook: delivers login codes through our SMS provider.
// https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
import { Webhook } from 'npm:standardwebhooks@1.0.0';
import { getSmsProvider, isSriLankanMobile } from '../_shared/sms/index.ts';
import { json, serviceClient } from '../_shared/supabase.ts';

interface HookPayload {
  user: { id: string; phone: string };
  sms: { otp: string };
}

function hookError(httpCode: number, message: string): Response {
  return json({ error: { http_code: httpCode, message } }, httpCode);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return hookError(405, 'Method not allowed');

  const secret = Deno.env.get('SEND_SMS_HOOK_SECRET');
  if (!secret) return hookError(500, 'SMS hook is not configured');

  const raw = await req.text();
  let payload: HookPayload;
  try {
    const wh = new Webhook(secret.replace(/^v1,whsec_/, ''));
    payload = wh.verify(raw, Object.fromEntries(req.headers)) as HookPayload;
  } catch {
    return hookError(401, 'Invalid signature');
  }

  const phone = payload.user.phone.startsWith('+') ? payload.user.phone : `+${payload.user.phone}`;
  if (!isSriLankanMobile(phone)) {
    return hookError(400, 'Only Sri Lankan mobile numbers (+94 7X XXX XXXX) are supported');
  }

  const provider = getSmsProvider();
  const body = `Your Nearbuy login code is ${payload.sms.otp}. Do not share this code.`;
  const result = await provider.send(phone, body);

  // Log every SMS. Never store the login code itself.
  const { error: logError } = await serviceClient()
    .from('sms_messages')
    .insert({
      kind: 'login_code',
      to_phone: phone,
      body: 'Your Nearbuy login code is ******. Do not share this code.',
      profile_id: payload.user.id,
      status: result.ok ? 'sent' : 'failed',
      provider: provider.name,
      provider_message_id: result.providerMessageId ?? null,
      error: result.error ?? null,
      attempts: 1,
      sent_at: result.ok ? new Date().toISOString() : null,
      status_updated_at: new Date().toISOString(),
    });
  if (logError) console.error('[send-sms-hook] failed to log sms', logError.message);

  if (!result.ok) return hookError(502, 'Could not send the login code. Please try again.');
  return json({});
});
