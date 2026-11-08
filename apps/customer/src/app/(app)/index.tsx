import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Image } from 'expo-image';
import { Link, Stack, useRouter } from 'expo-router';
import { formatCutoff, STORAGE_BUCKETS } from '@nearbuy/shared';
import { supabase, photoUrl } from '@/lib/supabase';
import { fetchSettings, useFocusedQuery } from '@/lib/data';
import { useCart } from '@/lib/cart';
import { Banner, Button, C, Card, ErrorText, Loading, T, s } from '@/components/ui';

export default function Home() {
  const router = useRouter();
  const cart = useCart();
  const { data, error, loading, reload } = useFocusedQuery(async () => {
    const [settings, shops] = await Promise.all([
      fetchSettings(),
      supabase.from('shops').select('*').order('sort_order').order('name'),
    ]);
    if (shops.error) throw shops.error;
    return { settings, shops: shops.data };
  });

  if (loading && !data) return <Loading />;
  const st = data?.settings;

  return (
    <View style={s.screen}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/orders" asChild>
              <Pressable hitSlop={12}>
                <T bold style={{ color: C.primaryPressed }}>My orders</T>
              </Pressable>
            </Link>
          ),
        }}
      />
      <FlatList
        data={data?.shops ?? []}
        keyExtractor={(i) => i.id!}
        contentContainerStyle={[s.content, { paddingBottom: 120 }]}
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <ErrorText>{error}</ErrorText>
            {st &&
              (st.is_open ? (
                <Banner tone="info">
                  <T bold>Order before {formatCutoff(st.cutoff_time!)} today</T>
                  <T muted size={14}>
                    Delivery {st.delivery_window_text} · Pay cash on delivery
                  </T>
                </Banner>
              ) : (
                <Banner tone="warn">
                  <T bold>Orders are closed for today</T>
                  <T muted size={14}>
                    {st.ordering_enabled
                      ? `Ordering opens again tomorrow. Cutoff is ${formatCutoff(st.cutoff_time!)}.`
                      : 'We are not taking orders right now.'}
                  </T>
                </Banner>
              ))}
            <T size={20} bold>
              Shops
            </T>
          </View>
        }
        ListEmptyComponent={<T muted>No shops are open yet.</T>}
        renderItem={({ item }) => {
          const cover = photoUrl(STORAGE_BUCKETS.businessCovers, item.cover_photo_path);
          return (
            <Pressable onPress={() => router.push({ pathname: '/shop/[id]', params: { id: item.id! } })}>
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {cover ? (
                  <Image source={cover} style={{ height: 120 }} contentFit="cover" />
                ) : (
                  <View style={{ height: 64, backgroundColor: C.primaryTint }} />
                )}
                <View style={{ padding: 14, gap: 2 }}>
                  <T size={17} bold>
                    {item.name}
                  </T>
                  <T muted size={14}>
                    {[item.area, ...(item.cuisine_tags ?? [])].filter(Boolean).join(' · ')}
                  </T>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
      {cart.count > 0 && (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24 }}>
          <Button title={`View cart · ${cart.count} item${cart.count > 1 ? 's' : ''}`} onPress={() => router.push('/cart')} />
        </View>
      )}
    </View>
  );
}
