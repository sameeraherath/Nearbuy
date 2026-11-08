import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatRs, formatSriLankanMobile, type OrderStatus } from '@nearbuy/shared';
import { supabase } from '@/lib/supabase';
import { useFocusedQuery } from '@/lib/data';
import { useSession } from '@/lib/session';
import { Button, Card, ErrorText, Loading, StatusPill, T, s } from '@/components/ui';
import { PhoneVerify } from '@/components/phone-verify';
import { AppBar } from '@/components/layout';

export default function Orders() {
  const { session } = useSession();
  if (!session) {
    return (
      <View style={s.screen}>
        <AppBar title="My orders" />
        <View style={s.content}>
          <Card style={{ gap: 10 }}>
            <T size={17} bold>See your orders</T>
            <T muted size={14}>Confirm the mobile number you ordered with.</T>
            <PhoneVerify verifyLabel="Show my orders" />
          </Card>
        </View>
      </View>
    );
  }
  return <OrdersList />;
}

function OrdersList() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const { data, error, loading, reload } = useFocusedQuery(async () => {
    const { data: rows, error: err } = await supabase
      .from('my_orders')
      .select('id, order_number, business_name, status, total_to_collect, delivery_date')
      .order('placed_at', { ascending: false })
      .limit(50);
    if (err) throw err;
    return rows;
  });

  return (
    <View style={s.screen}>
      <AppBar title="My orders" />
      {loading && !data ? (
        <Loading />
      ) : (
    <FlatList
      style={s.screen}
      data={data ?? []}
      keyExtractor={(o) => o.id!}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      ListHeaderComponent={<ErrorText>{error}</ErrorText>}
      ListEmptyComponent={
        <Card style={{ alignItems: 'center', gap: 6 }}>
          <T size={32}>🍽️</T>
          <T bold>No orders yet</T>
          <T muted size={14}>Your orders will show up here.</T>
        </Card>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push({ pathname: '/order/[id]', params: { id: item.id! } })}>
          <Card style={{ gap: 6 }}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T bold>{item.order_number}</T>
              <StatusPill status={item.status as OrderStatus} />
            </View>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <T muted>
                {item.business_name} · {item.delivery_date}
              </T>
              <T bold>{formatRs(item.total_to_collect ?? 0)}</T>
            </View>
          </Card>
        </Pressable>
      )}
      ListFooterComponent={
        <View style={{ marginTop: 24, gap: 8 }}>
          <T muted size={13} style={{ textAlign: 'center' }}>
            Signed in as {session?.user.phone ? formatSriLankanMobile('+' + session.user.phone.replace(/^\+/, '')) : ''}
          </T>
          <Button title="Sign out" variant="secondary" onPress={signOut} />
        </View>
      }
    />
      )}
    </View>
  );
}
