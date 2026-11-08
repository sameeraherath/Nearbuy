import { useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { formatRs, ORDER_STEPS, serverErrorMessage, type OrderStatus } from '@nearbuy/shared';
import { supabase } from '@/lib/supabase';
import { fetchSettings, useFocusedQuery } from '@/lib/data';
import { useOrderBroadcast } from '@/lib/realtime';
import { confirmAction, showMessage } from '@/lib/confirm';
import { formatDistance } from '@/lib/geo';
import { useLiveRoute } from '@/lib/route';
import { useSmoothPosition } from '@/lib/smooth';
import { LiveMap, type MapPoint } from '@/components/map';

type RiderPos = { lat: number; lng: number; updated_at: string };
import { Banner, Button, C, Card, ErrorText, Loading, StatusPill, T, s } from '@/components/ui';
import { AppBar } from '@/components/layout';

export default function OrderScreen() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const { data, error, loading, reload } = useFocusedQuery(async () => {
    const [order, items, code, settings] = await Promise.all([
      supabase.from('my_orders').select('*').eq('id', id).maybeSingle(),
      supabase.from('my_order_items').select('*').eq('order_id', id),
      supabase.from('order_codes').select('code').eq('order_id', id).maybeSingle(),
      fetchSettings(),
    ]);
    if (order.error) throw order.error;
    return { order: order.data, items: items.data ?? [], code: code.data?.code ?? null, settings };
  }, [id]);

  const [rider, setRider] = useState<RiderPos | null>(null);
  const [, setTick] = useState(0);
  const onTheWay = data?.order?.status === 'picked_up';

  useOrderBroadcast(id ? `order:${id}` : null, reload, {
    rider_location: (p) => {
      if (typeof p.lat === 'number' && typeof p.lng === 'number') {
        setRider({ lat: p.lat, lng: p.lng, updated_at: String(p.updated_at ?? new Date().toISOString()) });
      }
    },
  });

  // First paint of the rider's position (realtime keeps it fresh afterwards).
  useEffect(() => {
    if (!onTheWay || !id) {
      setRider(null);
      return;
    }
    supabase.rpc('order_rider_location', { p_order_id: id }).then(({ data: rows }) => {
      const r = rows?.[0];
      if (r) setRider({ lat: r.lat, lng: r.lng, updated_at: r.updated_at });
    });
    const t = setInterval(() => setTick((n) => n + 1), 10000);
    return () => clearInterval(t);
  }, [onTheWay, id]);

  // Uber-style: the rider glides along the road route towards the drop-off.
  const ord = data?.order;
  const homePt =
    ord?.location_lat != null && ord?.location_lng != null ? { lat: ord.location_lat, lng: ord.location_lng } : null;
  const riderTarget = onTheWay && rider ? { lat: rider.lat, lng: rider.lng } : null;
  const riderSmooth = useSmoothPosition(riderTarget);
  const live = useLiveRoute(riderTarget, onTheWay ? homePt : null);

  if (loading && !data) {
    return (
      <View style={s.screen}>
        <AppBar title="Order" />
        <Loading />
      </View>
    );
  }
  const o = data?.order;
  if (!o) {
    return (
      <View style={s.screen}>
        <AppBar title="Order" />
        <View style={s.content}>
          <ErrorText>{error ?? 'Order not found'}</ErrorText>
        </View>
      </View>
    );
  }

  const status = o.status as OrderStatus;
  const stepIndex = ORDER_STEPS.findIndex((st) => st.status === status);
  const canCancel = status === 'placed' && data.settings?.is_open && o.delivery_date === data.settings?.today;
  const help = data.settings?.help_phone;

  function cancel() {
    confirmAction('Cancel this order?', 'You can cancel until the daily cutoff.', 'Cancel order', async () => {
      const { error: err } = await supabase.rpc('cancel_order', { p_order_id: id });
      if (err) showMessage('Could not cancel', serverErrorMessage(err.message));
      reload();
    });
  }

  return (
    <View style={s.screen}>
    <AppBar title={o.order_number ?? 'Order'} subtitle={o.business_name ?? undefined} />
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { paddingBottom: 40 }]}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
    >
      {placed === '1' && status === 'placed' && (
        <Banner tone="ok">
          <T bold>Order placed!</T>
          <T muted size={14}>We also sent your code by SMS.</T>
        </Banner>
      )}

      <Card style={{ gap: 8 }}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T size={20} bold>{o.order_number}</T>
          <StatusPill status={status} />
        </View>
        <T muted>
          {o.business_name} · {o.delivery_date}
        </T>
      </Card>

      {status !== 'cancelled' && status !== 'delivered' && data.code && (
        <Card style={{ alignItems: 'center', gap: 4, borderColor: C.primary, backgroundColor: C.primaryTint }}>
          <T muted size={14}>Your delivery code</T>
          <T size={44} bold style={{ letterSpacing: 10 }}>{data.code}</T>
          <T muted size={13} style={{ textAlign: 'center' }}>
            Tell this to the rider only when you get your food.
          </T>
        </Card>
      )}

      {status !== 'cancelled' && (
        <Card style={{ gap: 10 }}>
          {ORDER_STEPS.map((st, i) => {
            const done = i <= stepIndex;
            return (
              <View key={st.status} style={s.row}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: done ? C.success : C.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {done && <T size={12} bold style={{ color: '#fff' }}>✓</T>}
                </View>
                <T bold={i === stepIndex} muted={!done}>{st.label}</T>
              </View>
            );
          })}
          {status === 'picked_up' && (
            <T muted size={14}>Your food is on the way. Have {formatRs(o.total_to_collect ?? 0)} ready in cash.</T>
          )}
        </Card>
      )}

      <Card style={{ gap: 8 }}>
        {data.items.map((i) => (
          <View key={i.id} style={[s.row, { justifyContent: 'space-between' }]}>
            <T muted={!!i.is_unavailable} style={i.is_unavailable ? { textDecorationLine: 'line-through' } : undefined}>
              {i.qty} × {i.name}
            </T>
            <T muted={!!i.is_unavailable}>{formatRs((i.selling_price ?? 0) * (i.qty ?? 0))}</T>
          </View>
        ))}
        {data.items.some((i) => i.is_unavailable) && (
          <T size={13} style={{ color: C.error }}>Crossed-out items were not available at the shop.</T>
        )}
        <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T muted>Delivery</T>
          <T>{o.delivery_fee ? formatRs(o.delivery_fee) : 'Free'}</T>
        </View>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <T bold>{status === 'delivered' ? 'Paid' : 'Pay in cash'}</T>
          <T bold>{formatRs(o.total_to_collect ?? 0)}</T>
        </View>
      </Card>

      {status !== 'cancelled' && status !== 'delivered' && o.location_lat != null && o.location_lng != null && (
        <Card style={{ gap: 8 }}>
          {onTheWay && live && (
            <View style={{ gap: 2 }}>
              <T size={22} bold>
                Arriving in about {live.minutes} min
              </T>
              <T muted size={14}>
                Rider is {formatDistance(live.meters)} away{live.onRoads ? '' : ' (approx.)'}
              </T>
            </View>
          )}
          <LiveMap
            height={onTheWay ? 340 : 200}
            route={onTheWay && live ? live.points : undefined}
            routeIsEstimate={!!live && !live.onRoads}
            points={[
              { id: 'home', kind: 'home', lat: o.location_lat, lng: o.location_lng, title: 'Drop-off' } as MapPoint,
              ...(onTheWay && riderSmooth
                ? [{ id: 'rider', kind: 'rider', lat: riderSmooth.lat, lng: riderSmooth.lng, title: 'Rider' } as MapPoint]
                : []),
            ]}
          />
          {onTheWay && rider ? (
            <T muted size={12}>
              Live · updated {ago(rider.updated_at)}
            </T>
          ) : onTheWay ? (
            <T muted size={13}>Waiting for the rider's location…</T>
          ) : (
            <T muted size={13}>Your rider will appear on the map once the food is picked up.</T>
          )}
        </Card>
      )}

      <Card style={{ gap: 4 }}>
        <T bold>Deliver to</T>
        <T>{[o.location_label, o.location_room].filter(Boolean).join(' · ')}</T>
        {!!o.location_note && <T muted size={14}>{o.location_note}</T>}
      </Card>

      <ErrorText>{error}</ErrorText>
      {canCancel && <Button title="Cancel order" variant="danger" onPress={cancel} />}
      {!!help && <Button title="Call for help" variant="secondary" onPress={() => Linking.openURL(`tel:${help}`)} />}
    </ScrollView>
    </View>
  );
}

function ago(iso: string): string {
  const sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec} s ago`;
  return `${Math.round(sec / 60)} min ago`;
}
