import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatRs, MAX_CODE_ATTEMPTS, serverErrorMessage, wrongCodeMessage } from '@nearbuy/shared';
import { supabase } from '@/lib/supabase';
import { useFocusedQuery } from '@/lib/data';
import { LiveMap } from '@/components/map';
import { Banner, Button, C, Card, ErrorText, Input, Loading, T, s } from '@/components/ui';

type Result = { result: 'delivered' | 'wrong_code' | 'locked'; attempts_left: number };

export default function DeliverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: order, error, loading, reload } = useFocusedQuery(async () => {
    const { data, error: err } = await supabase.from('orders').select('*, order_items(*)').eq('id', id).maybeSingle();
    if (err) throw err;
    return data;
  }, [id]);

  if (loading && !order) return <Loading />;
  if (!order) return <View style={s.content}><ErrorText>{error ?? 'Order not found'}</ErrorText></View>;

  const locked = order.code_attempts >= MAX_CODE_ATTEMPTS;
  const delivered = order.status === 'delivered';

  async function confirm() {
    setMessage(null);
    setBusy(true);
    const { data, error: err } = await supabase.rpc('confirm_delivery', { p_order_id: id, p_code: code });
    setBusy(false);
    if (err) return setMessage(serverErrorMessage(err.message));
    const res = data as Result;
    if (res.result === 'delivered') {
      reload();
      return;
    }
    setCode('');
    setMessage(res.result === 'locked' ? wrongCodeMessage(0) : wrongCodeMessage(res.attempts_left));
    reload();
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 6 }}>
          <T size={20} bold>{order.customer_name}</T>
          <T>{[order.location_label, order.location_room].filter(Boolean).join(' · ')}</T>
          {!!order.location_note && <T muted size={14}>“{order.location_note}”</T>}
          <T muted size={13}>{order.order_number}</T>
          <LiveMap
            height={180}
            showsUserLocation
            points={[{ id: 'drop', kind: 'stop', lat: order.location_lat, lng: order.location_lng, title: order.customer_name }]}
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Button title="Call" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${order.customer_phone}`)} />
            <Button
              title="Map"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() =>
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${order.location_lat},${order.location_lng}`)
              }
            />
          </View>
        </Card>

        <Card style={{ gap: 6 }}>
          {order.order_items.map((i) => (
            <View key={i.id} style={[s.row, { justifyContent: 'space-between' }]}>
              <T muted={i.is_unavailable} style={i.is_unavailable ? { textDecorationLine: 'line-through' } : undefined}>
                {i.qty} × {i.name}
              </T>
              <T muted={i.is_unavailable}>{formatRs(i.selling_price * i.qty)}</T>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T size={18} bold>Collect in cash</T>
            <T size={18} bold>{formatRs(order.total_to_collect)}</T>
          </View>
        </Card>

        {delivered ? (
          <>
            <Banner tone="ok">
              <T bold>Delivered</T>
              <T muted size={14}>Collected {formatRs(order.total_to_collect)} · your pay {formatRs(order.rider_pay)}</T>
            </Banner>
            <Button title="Back to today's run" onPress={() => router.back()} />
          </>
        ) : order.status !== 'picked_up' ? (
          <Banner tone="warn">
            <T>Mark this order as picked up before delivering.</T>
          </Banner>
        ) : locked ? (
          <Banner tone="warn">
            <T bold>Code locked after {MAX_CODE_ATTEMPTS} wrong tries</T>
            <T muted size={14}>Call the student, or ask admin to mark it delivered.</T>
          </Banner>
        ) : (
          <Card style={{ gap: 12 }}>
            <T bold>Ask the student for their 4-digit code</T>
            <Input
              keyboardType="number-pad"
              maxLength={4}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              style={{ textAlign: 'center', fontSize: 32, letterSpacing: 12, minHeight: 64 }}
            />
            <ErrorText>{message}</ErrorText>
            <Button title="Confirm delivery" onPress={confirm} loading={busy} disabled={code.length !== 4} />
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
