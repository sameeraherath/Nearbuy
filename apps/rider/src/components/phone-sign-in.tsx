import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { formatSriLankanMobile, normalizeSriLankanMobile, OTP_LENGTH } from '@nearbuy/shared';
import { supabase } from '@/lib/supabase';
import { Button, C, ErrorText, Input, T, s } from './ui';

/** Phone + SMS code sign in. `beforeSend` can reject a number (e.g. not a registered rider). */
export function PhoneSignIn({
  subtitle,
  beforeSend,
  createUser = true,
}: {
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
    const { error: err } = await supabase.auth.signInWithOtp({
      phone: e164,
      options: { shouldCreateUser: createUser },
    });
    setBusy(false);
    if (err) return setError(err.message);
    setPhone(e164);
    setCode('');
    setStep('code');
  }

  async function verify() {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    setBusy(false);
    if (err) setError(err.message);
    // On success the session listener switches to the app screens.
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 20 }}>
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
            <Button title="Send code" onPress={send} loading={busy} />
          </>
        ) : (
          <>
            <T muted>
              Enter the {OTP_LENGTH}-digit code sent to{' '}
              <T bold>{formatSriLankanMobile(phone)}</T>
            </T>
            <Input
              keyboardType="number-pad"
              autoFocus
              maxLength={OTP_LENGTH}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
            />
            <ErrorText>{error}</ErrorText>
            <Button title="Sign in" onPress={verify} loading={busy} disabled={code.length !== OTP_LENGTH} />
            <Button title="Use a different number" variant="secondary" onPress={() => setStep('phone')} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
