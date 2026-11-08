// TEMPORARY test login (no SMS). Signs a user in with a shared team code instead of an OTP.
// Enabled only while the TEST_LOGIN_CODE secret is set. Remove/unset before launch:
//   supabase secrets unset TEST_LOGIN_CODE
//   update auth.users set email = null where email like '%@test-login.nearbuy.lk';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { isSriLankanMobile } from '../_shared/sms/index.ts';
import { safeEqual, serviceClient } from '../_shared/supabase.ts';

type App = 'customer' | 'rider' | 'admin';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function normalize(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (!/^\d+$/.test(d)) return null;
  const national = d.startsWith('94') ? d.slice(2) : d.startsWith('0') ? d.slice(1) : d;
  const e164 = `+94${national}`;
  return isSriLankanMobile(e164) ? e164 : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const testCode = Deno.env.get('TEST_LOGIN_CODE') ?? '';
  if (testCode.length < 8) return reply({ error: 'Test login is turned off' }, 404);

  let body: { phone?: string; code?: string; app?: App };
  try {
    body = await req.json();
  } catch {
    return reply({ error: 'Invalid request' }, 400);
  }
  const app = body.app;
  if (app !== 'customer' && app !== 'rider' && app !== 'admin') return reply({ error: 'Invalid app' }, 400);
  const phone = normalize(body.phone ?? '');
  if (!phone) return reply({ error: 'Enter a Sri Lankan mobile number (07X XXX XXXX)' }, 400);
  if (!safeEqual((body.code ?? '').trim(), testCode)) return reply({ error: 'Wrong test code' }, 401);

  const admin = serviceClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, role, is_blocked, riders(is_active)')
    .eq('phone', phone)
    .maybeSingle();
  if (profileError) return reply({ error: profileError.message }, 500);

  let userId = profile?.id as string | undefined;
  if (app === 'customer') {
    if (profile && profile.role !== 'customer') {
      return reply({ error: `This number is registered as a ${profile.role}. Use the ${profile.role} app.` }, 403);
    }
    if (!profile) {
      // The on_auth_user_created trigger creates the customer profile.
      const { data, error } = await admin.auth.admin.createUser({ phone, phone_confirm: true });
      if (error || !data.user) return reply({ error: error?.message ?? 'Could not create account' }, 500);
      userId = data.user.id;
    }
  } else {
    if (!profile || profile.role !== app) return reply({ error: `This number is not registered as ${app === 'admin' ? 'an admin' : 'a rider'}.` }, 403);
    const rider = Array.isArray(profile.riders) ? profile.riders[0] : profile.riders;
    if (app === 'rider' && !rider?.is_active) return reply({ error: 'This rider account is inactive.' }, 403);
  }
  if (profile?.is_blocked) return reply({ error: 'Your number has been blocked. Please contact us.' }, 403);

  // Make a session without SMS: a synthetic confirmed email + magic-link token, verified server-side.
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId!);
  if (userError || !userData.user) return reply({ error: userError?.message ?? 'User not found' }, 500);
  let email = userData.user.email;
  if (!email) {
    email = `${phone.slice(1)}@test-login.nearbuy.lk`;
    const { error } = await admin.auth.admin.updateUserById(userId!, { email, email_confirm: true });
    if (error) return reply({ error: error.message }, 500);
  }
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (linkError || !link.properties?.hashed_token) return reply({ error: linkError?.message ?? 'Could not sign in' }, 500);

  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: verifyError } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  });
  if (verifyError || !verified.session) return reply({ error: verifyError?.message ?? 'Could not sign in' }, 500);

  return reply({
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
  });
});
