'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatSriLankanMobile, normalizeSriLankanMobile, OTP_LENGTH } from '@nearbuy/shared';
import { createClient } from '@/lib/supabase/client';

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
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: e164,
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (otpError) return setError(otpError.message);
    setPhone(e164);
    setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error: verifyError } = await createClient().auth.verifyOtp({ phone, token: code, type: 'sms' });
    setBusy(false);
    if (verifyError) return setError(verifyError.message);
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
          {busy ? 'Sending…' : 'Send code'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <p className="text-sm text-muted">
        Enter the code sent to <strong className="text-ink">{formatSriLankanMobile(phone)}</strong>
      </p>
      <input
        className="input text-center text-lg tracking-[0.5em]"
        inputMode="numeric"
        maxLength={OTP_LENGTH}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        autoFocus
      />
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn-primary w-full" disabled={busy || code.length !== OTP_LENGTH}>
        {busy ? 'Checking…' : 'Sign in'}
      </button>
      <button type="button" className="btn-ghost w-full" onClick={() => setStep('phone')}>
        Use a different number
      </button>
    </form>
  );
}
