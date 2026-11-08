'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Lets the signed-in admin replace their password (e.g. the one-time password they were given). */
export function ChangePassword() {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok?: string; error?: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (password.length < 10) return setMessage({ error: 'Use at least 10 characters' });
    if (password !== again) return setMessage({ error: 'Passwords do not match' });
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setMessage({ error: error.message });
    setPassword('');
    setAgain('');
    setMessage({ ok: 'Password changed. Use the new one next time you sign in.' });
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="new-password">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="new-password-again">
            Type it again
          </label>
          <input
            id="new-password-again"
            type="password"
            autoComplete="new-password"
            className="input"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
        {message?.error && <p className="text-sm text-bad">{message.error}</p>}
        {message?.ok && <p className="text-sm text-ok">{message.ok}</p>}
      </div>
    </form>
  );
}
