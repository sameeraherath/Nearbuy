import { useState } from 'react';
import { View } from 'react-native';
import { formatSriLankanMobile, normalizeSriLankanMobile, OTP_LENGTH } from '@nearbuy/shared';
import { supabase } from '@/lib/supabase';
import { Button, ErrorText, Input, T } from './ui';

/** TEMPORARY: while there is no SMS provider, sign in with a shared team code (see test-login function). */
const TEST_LOGIN = process.env.EXPO_PUBLIC_TEST_LOGIN === 'true';

/**
 * Inline mobile-number confirmation (phone → code). Used as the last step of checkout and
 * on "My orders". Calls `onVerified` once the session exists.
 */
export function PhoneVerify({
  verifyLabel = 'Confirm',
  onVerified,
}: {
  verifyLabel?: string;
  onVerified?: () => void;
}) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [input, setInput] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setError(null);
    const e164 = normalizeSriLankanMobile(input);
    if (!e164) return setError('Enter a Sri Lankan mobile number (07X XXX XXXX)');
    if (!TEST_LOGIN) {
      setBusy(true);
      const { error: err } = await supabase.auth.signInWithOtp({ phone: e164 });
      setBusy(false);
      if (err) return setError(err.message);
    }
    setPhone(e164);
    setCode('');
    setStep('code');
  }

  async function verify() {
    setError(null);
    setBusy(true);
    if (TEST_LOGIN) {
      const { data, error: fnErr } = await supabase.functions.invoke<{ access_token: string; refresh_token: string }>(
        'test-login',
        { body: { phone, code, app: 'customer' } },
      );
      if (fnErr || !data) {
        setBusy(false);
        let message = fnErr?.message ?? 'Could not confirm your number';
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
      const { error: sessionErr } = await supabase.auth.setSession(data);
      setBusy(false);
      if (sessionErr) return setError(sessionErr.message);
    } else {
      const { error: err } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
      setBusy(false);
      if (err) return setError(err.message);
    }
    onVerified?.();
  }

  if (step === 'phone') {
    return (
      <View style={{ gap: 10 }}>
        <Input
          label="Mobile number"
          placeholder="07X XXX XXXX"
          keyboardType="phone-pad"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          autoComplete="tel"
        />
        <ErrorText>{error}</ErrorText>
        <Button title={TEST_LOGIN ? 'Continue' : 'Send code'} onPress={send} loading={busy} />
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <T muted size={14}>
        {TEST_LOGIN ? 'Test mode: enter the team test code for ' : `Enter the ${OTP_LENGTH}-digit code sent to `}
        <T bold size={14}>{formatSriLankanMobile(phone)}</T>
      </T>
      <Input
        keyboardType="number-pad"
        maxLength={TEST_LOGIN ? 32 : OTP_LENGTH}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
        style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        autoFocus
      />
      <ErrorText>{error}</ErrorText>
      <Button
        title={verifyLabel}
        onPress={verify}
        loading={busy}
        disabled={TEST_LOGIN ? code.length < 8 : code.length !== OTP_LENGTH}
      />
      <Button title="Use a different number" variant="secondary" onPress={() => setStep('phone')} />
    </View>
  );
}
