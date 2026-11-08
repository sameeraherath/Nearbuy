'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatSriLankanMobile, normalizeSriLankanMobile, OTP_LENGTH } from '@nearbuy/shared';
import { createClient } from '@/lib/supabase/client';

/** TEMPORARY: while there is no SMS provider, sign in with a shared team code (see test-login function). */
const TEST_LOGIN = process.env.NEXT_PUBLIC_TEST_LOGIN === 'true';

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const e164 = normalizeSriLankanMobile(phoneInput);
    if (!e164) return setError('Enter a Sri Lankan mobile number (07X XXX XXXX)');
    setBusy(true);
    const supabase = createClient();
    const { data: ok, error: rpcError } = await supabase.rpc('is_registered_staff', {
      p_phone: e164,
      p_role: 'admin',
    });
    if (rpcError || !ok) {
      setBusy(false);
      return setError(rpcError ? rpcError.message : 'This number is not registered as an admin.');
    }
    if (!TEST_LOGIN) {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: e164,
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        setBusy(false);
        return setError(otpError.message);
      }
    }
    setBusy(false);
    setPhone(e164);
    setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    if (TEST_LOGIN) {
      const { data, error: fnErr } = await supabase.functions.invoke<{ access_token: string; refresh_token: string }>(
        'test-login',
        { body: { phone, code, app: 'admin' } },
      );
      if (fnErr || !data) {
        setBusy(false);
        let message = fnErr?.message ?? 'Could not sign in';
        const ctx = (fnErr as { context?: Response } | null)?.context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            message = ((await ctx.json()) as { error?: string }).error ?? message;
          } catch {
            // keep the generic message
          }
        }
        return setError(message);
      }
      const { error: sessionError } = await supabase.auth.setSession(data);
      setBusy(false);
      if (sessionError) return setError(sessionError.message);
    } else {
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
      setBusy(false);
      if (verifyError) return setError(verifyError.message);
    }
    router.replace('/orders');
    router.refresh();
  }

  if (step === 'phone') {
    return (
      <form onSubmit={sendCode} className="space-y-4">
        <div>
          <label className="label" htmlFor="phone">
            Mobile number
          </label>
          <input
            id="phone"
            className="input"
            inputMode="tel"
            placeholder="07X XXX XXXX"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            autoFocus
          />
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Sending…' : TEST_LOGIN ? 'Continue' : 'Send code'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-muted">
        {TEST_LOGIN ? 'Test mode: enter the team test code for ' : 'Enter the code sent to '}
        <strong className="text-ink">{formatSriLankanMobile(phone)}</strong>
      </p>
      <input
        className="input text-center text-lg tracking-[0.5em]"
        inputMode="numeric"
        maxLength={TEST_LOGIN ? 32 : OTP_LENGTH}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        autoFocus
      />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn-primary w-full" disabled={busy || (TEST_LOGIN ? code.length < 8 : code.length !== OTP_LENGTH)}>
        {busy ? 'Checking…' : 'Sign in'}
      </button>
      <button type="button" className="btn-ghost w-full" onClick={() => setStep('phone')}>
        Use a different number
      </button>
    </form>
  );
}
