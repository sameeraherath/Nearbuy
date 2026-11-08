import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatRs } from '@nearbuy/shared';
import { supabase } from '@/lib/supabase';
import { useFocusedQuery } from '@/lib/data';
import { distanceMeters, formatDistance } from '@/lib/geo';
import { useLiveRoute } from '@/lib/route';
import { useShareLocation } from '@/lib/use-share-location';
import { NavMap } from '@/components/map';
import { Button, C, ErrorText, Loading, T } from '@/components/ui';

/** Treat the rider as arrived inside this radius. */
const ARRIVED_METERS = 60;

export default function NavigateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sheetHeight, setSheetHeight] = useState(260);

  const { data: order, error, loading } = useFocusedQuery(async () => {
    const { data, error: err } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
    if (err) throw err;
    return data;
  }, [id]);

  const onTheWay = order?.status === 'picked_up';
  const share = useShareLocation(!!order && (onTheWay || order.status === 'assigned'), { fast: true });
  const destination = order ? { lat: order.location_lat, lng: order.location_lng } : null;
  const live = useLiveRoute(share.position, destination);

  if (loading && !order) return <Loading />;
  if (!order || !destination) {
    return (
      <View style={{ flex: 1, padding: 16, paddingTop: insets.top + 16, gap: 12 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ErrorText>{error ?? 'Order not found'}</ErrorText>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const arrived = !!share.position && distanceMeters(share.position, destination) <= ARRIVED_METERS;

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <NavMap
        rider={share.position}
        heading={share.heading}
        destination={destination}
        route={live?.points}
        routeIsEstimate={!!live && !live.onRoads}
        bottomInset={sheetHeight}
      />

      {/* Top: back + live status */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, flexDirection: 'row', gap: 8 }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Back"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: C.surface,
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 3,
          }}
        >
          <T size={22} bold>
            ←
          </T>
        </Pressable>
        <View
          style={{
            flex: 1,
            backgroundColor: C.navy,
            borderRadius: 14,
            paddingHorizontal: 14,
            justifyContent: 'center',
            elevation: 3,
          }}
        >
          <T size={13} bold style={{ color: '#fff' }} numberOfLines={1}>
            {share.state === 'sharing'
              ? '● Live — customer can see you coming'
              : share.state === 'denied'
                ? 'Allow location to navigate'
                : share.state === 'error'
                  ? (share.errorText ?? 'Location problem')
                  : 'Finding your location…'}
          </T>
        </View>
      </View>

      {/* Bottom sheet */}
      <View
        onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: C.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: insets.bottom + 14,
          gap: 10,
          elevation: 8,
        }}
      >
        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', gap: 10 }}>
          {arrived ? (
            <T size={22} bold style={{ color: C.success }}>
              You've arrived
            </T>
          ) : live ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <T size={26} bold>
                {live.minutes} min
              </T>
              <T size={16} muted>
                · {formatDistance(live.meters)}
                {live.onRoads ? '' : ' (approx.)'}
              </T>
            </View>
          ) : (
            <T muted>Waiting for GPS…</T>
          )}

          <View style={{ gap: 2 }}>
            <T size={17} bold>
              {order.customer_name}
            </T>
            <T>{[order.location_label, order.location_room].filter(Boolean).join(' · ')}</T>
            {!!order.location_note && (
              <T muted size={14}>
                “{order.location_note}”
              </T>
            )}
            <T muted size={13}>
              {order.order_number} · collect {formatRs(order.total_to_collect)} cash
            </T>
          </View>

          {!onTheWay && (
            <T size={13} style={{ color: C.error }}>
              Mark this order as picked up first so the customer can follow you.
            </T>
          )}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="Call"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
            />
            <Button
              title={arrived ? 'Enter code' : 'Arrived'}
              style={{ flex: 2 }}
              disabled={!onTheWay}
              onPress={() => router.replace({ pathname: '/order/[id]', params: { id: order.id } })}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
