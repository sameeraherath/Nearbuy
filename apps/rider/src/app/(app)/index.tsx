import { useState } from 'react';
import { Alert, Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { formatRs, formatSriLankanMobile, serverErrorMessage } from '@nearbuy/shared';
import { supabase } from '@/lib/supabase';
import { fetchSettings, useFocusedQuery } from '@/lib/data';
import { fetchMyOrders, type RiderOrder } from '@/lib/orders';
import { useOrderBroadcast } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { Button, C, Card, ErrorText, Loading, StatusPill, T, s } from '@/components/ui';

export default function Today() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const uid = session?.user.id ?? null;
  const [busyShop, setBusyShop] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);

  const { data, error, loading, reload } = useFocusedQuery(async () => {
    const settings = await fetchSettings();
    const orders = await fetchMyOrders(uid!, settings!.today!);
    return { settings, orders };
  }, [uid]);

  useOrderBroadcast(uid ? `rider:${uid}` : null, reload);

  if (loading && !data) return <Loading />;
  const orders = data?.orders ?? [];

  const toPickUp = orders.filter((o) => o.status === 'assigned');
  const toDeliver = orders.filter((o) => o.status === 'picked_up');
  const done = orders.filter((o) => o.status === 'delivered');

  const groups = new Map<string, { name: string; orders: RiderOrder[] }>();
  for (const o of toPickUp) {
    const g = groups.get(o.business_id) ?? { name: o.shopName, orders: [] };
    g.orders.push(o);
    groups.set(o.business_id, g);
  }

  const payShops = toPickUp.reduce((n, o) => n + o.items_shop_total, 0);
  const toCollect = [...toPickUp, ...toDeliver].reduce((n, o) => n + o.total_to_collect, 0);
  const collected = done.reduce((n, o) => n + o.total_to_collect, 0);
  const myPay = done.reduce((n, o) => n + o.rider_pay, 0);

  async function pickUp(shopId: string, list: RiderOrder[]) {
    setBusyShop(shopId);
    const { error: err } = await supabase.rpc('rider_mark_picked_up', { p_order_ids: list.map((o) => o.id) });
    setBusyShop(null);
    if (err) Alert.alert('Could not update', serverErrorMessage(err.message));
    reload();
  }

  async function toggleItem(itemId: string, unavailable: boolean, itemName: string) {
    const go = async () => {
      setBusyItem(itemId);
      const { error: err } = await supabase.rpc('rider_set_item_unavailable', {
        p_order_item_id: itemId,
        p_unavailable: unavailable,
      });
      setBusyItem(null);
      if (err) Alert.alert('Could not update', serverErrorMessage(err.message));
      reload();
    };
    if (!unavailable) return go();
    Alert.alert(`${itemName} not available?`, 'The customer gets an SMS with the new total.', [
      { text: 'Back', style: 'cancel' },
      { text: 'Mark unavailable', style: 'destructive', onPress: go },
    ]);
  }

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { paddingBottom: 48 }]}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              hitSlop={12}
              onPress={() =>
                Alert.alert('Sign out?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign out', onPress: signOut },
                ])
              }
            >
              <T style={{ color: '#fff' }}>Sign out</T>
            </Pressable>
          ),
        }}
      />
      <ErrorText>{error}</ErrorText>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label="Pay shops" value={formatRs(payShops)} />
        <Stat label="To collect" value={formatRs(toCollect)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Stat label="Collected" value={formatRs(collected)} />
        <Stat label={`My pay (${done.length})`} value={formatRs(myPay)} />
      </View>

      {orders.length === 0 && (
        <Card>
          <T bold>No orders yet</T>
          <T muted size={14}>Orders assigned to you today will show up here.</T>
        </Card>
      )}

      {groups.size > 0 && <Section title={`1. Pick up (${toPickUp.length})`} />}
      {[...groups.entries()].map(([shopId, g]) => (
        <Card key={shopId} style={{ gap: 12 }}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T size={18} bold>{g.name}</T>
            <T bold>Pay {formatRs(g.orders.reduce((n, o) => n + o.items_shop_total, 0))}</T>
          </View>
          {g.orders.map((o) => (
            <View key={o.id} style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }}>
              <T bold>
                {o.order_number} · {o.customer_name}
              </T>
              {o.items.map((i) => (
                <Pressable
                  key={i.id}
                  disabled={busyItem === i.id}
                  onPress={() => toggleItem(i.id, !i.is_unavailable, i.name)}
                  style={[s.row, { justifyContent: 'space-between', minHeight: 36 }]}
                >
                  <T
                    muted={i.is_unavailable}
                    style={i.is_unavailable ? { textDecorationLine: 'line-through' } : undefined}
                  >
                    {i.qty} × {i.name}
                  </T>
                  <T size={13} style={{ color: i.is_unavailable ? C.success : C.error }}>
                    {i.is_unavailable ? 'Undo' : 'Not available'}
                  </T>
                </Pressable>
              ))}
            </View>
          ))}
          <Button
            title={`Picked up ${g.orders.length} order${g.orders.length > 1 ? 's' : ''}`}
            loading={busyShop === shopId}
            onPress={() => pickUp(shopId, g.orders)}
          />
        </Card>
      ))}

      {toDeliver.length > 0 && <Section title={`2. Deliver (${toDeliver.length})`} />}
      {toDeliver.map((o) => (
        <Card key={o.id} style={{ gap: 6 }}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <T size={17} bold>{o.customer_name}</T>
            <T size={17} bold>{formatRs(o.total_to_collect)}</T>
          </View>
          <T>{[o.location_label, o.location_room].filter(Boolean).join(' · ')}</T>
          {!!o.location_note && <T muted size={14}>“{o.location_note}”</T>}
          <T muted size={13}>
            {o.order_number} · {o.shopName}
          </T>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Button
              title="Call"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => Linking.openURL(`tel:${o.customer_phone}`)}
            />
            <Button
              title="Map"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() =>
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${o.location_lat},${o.location_lng}`)
              }
            />
            <Button
              title="Deliver"
              style={{ flex: 1.4 }}
              onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })}
            />
          </View>
        </Card>
      ))}

      {done.length > 0 && <Section title={`Done (${done.length})`} />}
      {done.map((o) => (
        <Card key={o.id} style={[s.row, { justifyContent: 'space-between' }]}>
          <View>
            <T bold>{o.order_number}</T>
            <T muted size={13}>{o.customer_name}</T>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <StatusPill status="delivered" />
            <T size={13}>{formatRs(o.total_to_collect)}</T>
          </View>
        </Card>
      ))}

      {!!data?.settings?.help_phone && (
        <Button
          title={`Call admin (${formatSriLankanMobile(data.settings.help_phone)})`}
          variant="secondary"
          onPress={() => Linking.openURL(`tel:${data.settings!.help_phone}`)}
        />
      )}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1, padding: 12 }}>
      <T muted size={13}>{label}</T>
      <T size={20} bold>{value}</T>
    </Card>
  );
}

function Section({ title }: { title: string }) {
  return (
    <T size={13} bold muted style={{ marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {title}
    </T>
  );
}
