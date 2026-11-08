import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { computeCartTotals, formatCutoff, formatRs, serverErrorMessage } from '@nearbuy/shared';
import { supabase } from '@/lib/supabase';
import { fetchSettings, useFocusedQuery } from '@/lib/data';
import { useCart } from '@/lib/cart';
import { useSession } from '@/lib/session';
import { Stepper } from '@/components/stepper';
import { LocationPicker } from '@/components/map';
import { CAMPUS, distanceMeters, type LatLng } from '@/lib/geo';
import { Banner, Button, C, Card, ErrorText, Input, Loading, T, s } from '@/components/ui';

const SAVED = 'saved';
/** Moving the pin further than this from a chosen place makes it a custom "Pinned location". */
const SNAP_METERS = 75;

export default function CartScreen() {
  const router = useRouter();
  const cart = useCart();
  const { session } = useSession();
  const uid = session?.user.id;

  const { data, loading, error } = useFocusedQuery(async () => {
    const [settings, places, saved, profile] = await Promise.all([
      fetchSettings(),
      supabase.from('places').select('*').order('sort_order').order('name'),
      supabase.from('customer_locations').select('*').eq('customer_id', uid!).eq('is_default', true).maybeSingle(),
      supabase.from('profiles').select('full_name').eq('id', uid!).maybeSingle(),
    ]);
    if (places.error) throw places.error;
    return { settings, places: places.data, saved: saved.data, name: profile.data?.full_name ?? '' };
  }, [uid]);

  const [placeKey, setPlaceKey] = useState<string | null>(null);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [room, setRoom] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  // Prefill from the saved default location and profile once.
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (!data || prefilled) return;
    setPrefilled(true);
    setName(data.name);
    if (data.saved) {
      setPlaceKey(data.saved.place_id ?? SAVED);
      setPin({ lat: data.saved.lat, lng: data.saved.lng });
      setRoom(data.saved.room);
      setNote(data.saved.note);
    } else {
      const first = data.places[0];
      setPin(first ? { lat: first.lat, lng: first.lng } : CAMPUS);
    }
  }, [data, prefilled]);

  if (loading && !data) return <Loading />;
  const st = data?.settings;

  if (cart.count === 0) {
    return (
      <View style={[s.content, { flex: 1, justifyContent: 'center' }]}>
        <T size={18} bold style={{ textAlign: 'center' }}>Your cart is empty</T>
        <Button title="Browse shops" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const totals = st
    ? computeCartTotals(
        cart.lines.map((l) => ({ qty: l.qty, price: l.price })),
        {
          delivery_fee: st.delivery_fee ?? 0,
          free_delivery_over: st.free_delivery_over,
          free_delivery_until: st.free_delivery_until,
          min_order_amount: st.min_order_amount ?? 0,
        },
        st.today!,
      )
    : null;

  const savedCustom = data?.saved && !data.saved.place_id ? data.saved : null;
  const chosenPlace = data?.places.find((p) => p.id === placeKey);

  function choosePlace(key: string, at: LatLng) {
    setPlaceKey(key);
    setPin(at);
  }

  function movePin(p: LatLng) {
    setPin(p);
    // Snap back to "custom" when the pin leaves the chosen place / saved spot.
    const anchor = chosenPlace ?? (placeKey === SAVED ? savedCustom : null);
    if (anchor && distanceMeters(p, { lat: anchor.lat, lng: anchor.lng }) > SNAP_METERS) setPlaceKey(null);
  }

  async function placeOrder() {
    setSubmitError(null);
    if (!name.trim()) return setSubmitError('Please enter your name');
    if (!pin) return setSubmitError('Please choose a delivery location');
    let location;
    if (chosenPlace) {
      location = { place_id: chosenPlace.id, label: chosenPlace.name, room, note, lat: pin.lat, lng: pin.lng };
    } else if (placeKey === SAVED && savedCustom) {
      location = { label: savedCustom.label, room, note, lat: pin.lat, lng: pin.lng };
    } else {
      if (!room.trim() && !note.trim()) {
        return setSubmitError('For a pinned location, add a room/house or a note so the rider can find you');
      }
      location = { label: 'Pinned location', room, note, lat: pin.lat, lng: pin.lng };
    }
    setPlacing(true);
    const { data: res, error: err } = await supabase.rpc('place_order', {
      p_business_id: cart.shopId!,
      p_items: cart.lines.map((l) => ({ food_id: l.foodId, qty: l.qty })),
      p_location: location,
      p_customer_name: name.trim(),
      p_save_location: true,
      p_client_ref: cart.clientRef,
    });
    setPlacing(false);
    if (err) return setSubmitError(serverErrorMessage(err.message));
    const orderId = (res as { order_id: string }).order_id;
    cart.clear();
    router.dismissAll();
    router.push({ pathname: '/order/[id]', params: { id: orderId, placed: '1' } });
  }

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: 40 }]} keyboardShouldPersistTaps="handled">
        <ErrorText>{error}</ErrorText>
        {st && !st.is_open && (
          <Banner tone="warn">
            <T bold>Orders are closed for today</T>
            <T muted size={14}>The cutoff was {formatCutoff(st.cutoff_time!)}.</T>
          </Banner>
        )}

        <Card style={{ gap: 12 }}>
          <T size={17} bold>{cart.shopName}</T>
          {cart.lines.map((l) => (
            <View key={l.foodId} style={[s.row, { justifyContent: 'space-between' }]}>
              <View style={{ flex: 1 }}>
                <T>{l.name}</T>
                <T muted size={13}>{formatRs(l.price)} each</T>
              </View>
              <Stepper qty={l.qty} onChange={(n) => cart.setQty(l.foodId, n)} />
            </View>
          ))}
        </Card>

        <Card style={{ gap: 10 }}>
          <T size={17} bold>Deliver to</T>
          {pin && <LocationPicker value={pin} onChange={movePin} />}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {savedCustom && (
              <Chip
                label={savedCustom.label}
                active={placeKey === SAVED}
                onPress={() => choosePlace(SAVED, { lat: savedCustom.lat, lng: savedCustom.lng })}
              />
            )}
            {data?.places.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                active={placeKey === p.id}
                onPress={() => choosePlace(p.id, { lat: p.lat, lng: p.lng })}
              />
            ))}
          </View>
          {placeKey === null && pin && (
            <T size={13} muted>📍 Pinned location — add your room or a landmark below.</T>
          )}
          <Input label="Room / house" placeholder="e.g. Room 214" value={room} onChangeText={setRoom} maxLength={40} />
          <Input
            label="Note for the rider (optional)"
            placeholder="e.g. Call when you reach the gate"
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />
          <Input label="Your name" value={name} onChangeText={setName} maxLength={60} autoCapitalize="words" />
        </Card>

        {totals && (
          <Card style={{ gap: 6 }}>
            <Line label="Items" value={formatRs(totals.itemsTotal)} />
            <Line label="Delivery" value={totals.deliveryFee === 0 ? 'Free' : formatRs(totals.deliveryFee)} />
            <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
            <Line label="Pay in cash" value={formatRs(totals.total)} bold />
            {!totals.meetsMinimum && (
              <T style={{ color: C.error }} size={14}>
                Minimum order is {formatRs(st!.min_order_amount!)}. Add {formatRs(totals.shortBy)} more.
              </T>
            )}
          </Card>
        )}

        <ErrorText>{submitError}</ErrorText>
        <Button
          title={totals ? `Place order · ${formatRs(totals.total)}` : 'Place order'}
          onPress={placeOrder}
          loading={placing}
          disabled={!st?.is_open || !totals?.meetsMinimum}
        />
        <T muted size={13} style={{ textAlign: 'center' }}>
          You pay the rider in cash and share your 4-digit delivery code.
        </T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        minHeight: 40,
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? C.primary : C.border,
        backgroundColor: active ? C.primaryTint : C.surface,
      }}
    >
      <T size={14} bold={active}>{label}</T>
    </Pressable>
  );
}

function Line({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={[s.row, { justifyContent: 'space-between' }]}>
      <T bold={bold} muted={!bold}>{label}</T>
      <T bold={bold}>{value}</T>
    </View>
  );
}
