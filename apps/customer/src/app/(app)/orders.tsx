import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatRs, formatSriLankanMobile, type OrderStatus } from '@nearbuy/shared';
import { supabase } from '@/lib/supabase';
import { useFocusedQuery } from '@/lib/data';
import { useSession } from '@/lib/session';
import { Button, Card, ErrorText, Loading, StatusPill, T, s } from '@/components/ui';

export default function Orders() {
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

  if (loading && !data) return <Loading />;

  return (
    <FlatList
      style={s.screen}
      data={data ?? []}
      keyExtractor={(o) => o.id!}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
      ListHeaderComponent={<ErrorText>{error}</ErrorText>}
      ListEmptyComponent={<T muted>No orders yet.</T>}
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
  );
}
