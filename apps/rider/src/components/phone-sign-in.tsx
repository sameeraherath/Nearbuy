import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { formatSriLankanMobile, normalizeSriLankanMobile, OTP_LENGTH } from '@nearbuy/shared';
import { supabase } from '@/lib/supabase';
import { Button, C, ErrorText, Input, T, s } from './ui';

/** TEMPORARY: while there is no SMS provider, sign in with a shared team code (see test-login function). */
const TEST_LOGIN = process.env.EXPO_PUBLIC_TEST_LOGIN === 'true';

/** Phone + SMS code sign in. `beforeSend` can reject a number (e.g. not a registered rider). */
export function PhoneSignIn({
  app,
  subtitle,
  beforeSend,
  createUser = true,
}: {
  app: 'customer' | 'rider';
  subtitle: string;
  beforeSend?: (e164: string) => Promise<string | null>;
  createUser?: boolean;
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
    setBusy(true);
    const rejected = beforeSend ? await beforeSend(e164) : null;
    if (rejected) {
      setBusy(false);
      return setError(rejected);
    }
    if (!TEST_LOGIN) {
      const { error: err } = await supabase.auth.signInWithOtp({
        phone: e164,
        options: { shouldCreateUser: createUser },
      });
      if (err) {
        setBusy(false);
        return setError(err.message);
      }
    }
    setBusy(false);
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
        { body: { phone, code, app } },
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
      const { error: sessionErr } = await supabase.auth.setSession(data);
      setBusy(false);
      if (sessionErr) setError(sessionErr.message);
      return;
    }
    const { error: err } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    setBusy(false);
    if (err) setError(err.message);
    // On success the session listener switches to the app screens.
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20, width: '100%', maxWidth: 480, alignSelf: 'center' }}>
        <View>
          <T size={36} bold>
            near<T size={36} bold style={{ color: C.primary }}>buy</T>
          </T>
          <T muted>{subtitle}</T>
        </View>
        {step === 'phone' ? (
          <>
            <Input
              label="Mobile number"
              placeholder="07X XXX XXXX"
              keyboardType="phone-pad"
              autoFocus
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
            />
            <ErrorText>{error}</ErrorText>
            <Button title={TEST_LOGIN ? 'Continue' : 'Send code'} onPress={send} loading={busy} />
          </>
        ) : (
          <>
            {TEST_LOGIN ? (
              <T muted>
                Test mode: enter the team test code for <T bold>{formatSriLankanMobile(phone)}</T>
              </T>
            ) : (
              <T muted>
                Enter the {OTP_LENGTH}-digit code sent to{' '}
                <T bold>{formatSriLankanMobile(phone)}</T>
              </T>
            )}
            <Input
              keyboardType="number-pad"
              autoFocus
              maxLength={TEST_LOGIN ? 32 : OTP_LENGTH}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
            />
            <ErrorText>{error}</ErrorText>
            <Button title="Sign in" onPress={verify} loading={busy} disabled={TEST_LOGIN ? code.length < 8 : code.length !== OTP_LENGTH} />
            <Button title="Use a different number" variant="secondary" onPress={() => setStep('phone')} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
