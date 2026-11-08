'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeSriLankanMobile } from '@nearbuy/shared';
import { createClient } from '@/lib/supabase/client';
import { adminEmail } from '@/lib/admin-email';

/** Admin sign in: mobile number + password (no SMS). */
export function LoginForm() {
  const router = useRouter();
  const [phoneInput, setPhoneInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const e164 = normalizeSriLankanMobile(phoneInput);
    if (!e164) return setError('Enter a Sri Lankan mobile number (07X XXX XXXX)');
    if (!password) return setError('Enter your password');
    setBusy(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: adminEmail(e164),
      password,
    });
    setBusy(false);
    if (signInError) {
      return setError(
        /invalid login credentials/i.test(signInError.message)
          ? 'Wrong number or password.'
          : signInError.message,
      );
    }
    router.replace('/orders');
    router.refresh();
  }

  return (
    <form onSubmit={signIn} className="space-y-4">
      <div>
        <label className="label" htmlFor="phone">
          Mobile number
        </label>
        <input
          id="phone"
          className="input"
          inputMode="tel"
          autoComplete="username"
          placeholder="07X XXX XXXX"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          autoFocus
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="input"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
