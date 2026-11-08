import { RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatCutoff, formatRs } from '@nearbuy/shared';
import { supabase } from '@/lib/supabase';
import { fetchSettings, useFocusedQuery } from '@/lib/data';
import { useCart } from '@/lib/cart';
import { closesIn } from '@/lib/cutoff';
import { AppBar, BarButton, BottomBar } from '@/components/layout';
import { ShopCard } from '@/components/shop-card';
import { Banner, Button, ErrorText, Loading, T, s } from '@/components/ui';

const WIDE = 1080;

export default function Home() {
  const router = useRouter();
  const cart = useCart();
  const { width } = useWindowDimensions();
  const cols = width >= 980 ? 3 : width >= 640 ? 2 : 1;

  const { data, error, loading, reload } = useFocusedQuery(async () => {
    const [settings, shops] = await Promise.all([
      fetchSettings(),
      supabase.from('shops').select('*').order('sort_order').order('name'),
    ]);
    if (shops.error) throw shops.error;
    return { settings, shops: shops.data };
  });

  const st = data?.settings;
  const shops = data?.shops ?? [];
  const cartTotal = cart.lines.reduce((n, l) => n + l.price * l.qty, 0);
  const countdown = st?.is_open && st.cutoff_time ? closesIn(st.cutoff_time) : null;

  return (
    <View style={s.screen}>
      <AppBar brand back={false} maxWidth={WIDE} right={<BarButton label="My orders" onPress={() => router.push('/orders')} />} />
      {loading && !data ? (
        <Loading />
      ) : (
        <ScrollView
          contentContainerStyle={[s.content, { maxWidth: WIDE, paddingBottom: cart.count > 0 ? 120 : 32 }]}
          refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}
        >
          <ErrorText>{error}</ErrorText>
          {st &&
            (st.is_open ? (
              <Banner tone="info">
                <T bold>Order by {formatCutoff(st.cutoff_time!)} today for delivery {st.delivery_window_text}</T>
                <T muted size={14}>
                  {countdown ? `${countdown} · ` : ''}Pay cash on delivery
                </T>
              </Banner>
            ) : (
              <Banner tone="warn">
                <T bold>Orders are closed for today</T>
                <T muted size={14}>
                  {st.ordering_enabled
                    ? `You can browse menus now. Ordering opens again tomorrow (cutoff ${formatCutoff(st.cutoff_time!)}).`
                    : 'We are not taking orders right now.'}
                </T>
              </Banner>
            ))}

          <T size={20} bold style={{ marginTop: 4 }}>
            Shops near campus
          </T>
          {shops.length === 0 ? (
            <T muted>No shops are open yet.</T>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
              {shops.map((shop) => (
                <View key={shop.id} style={{ width: cols === 1 ? '100%' : cols === 2 ? '49%' : '32.4%' }}>
                  <ShopCard
                    shop={{
                      id: shop.id!,
                      name: shop.name ?? '',
                      area: shop.area,
                      cuisine_tags: shop.cuisine_tags,
                      cover_photo_path: shop.cover_photo_path,
                    }}
                    onPress={() => router.push({ pathname: '/shop/[id]', params: { id: shop.id! } })}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
      {cart.count > 0 && (
        <BottomBar>
          <Button
            title={`View cart · ${cart.count} item${cart.count > 1 ? 's' : ''} · ${formatRs(cartTotal)}`}
            onPress={() => router.push('/cart')}
          />
        </BottomBar>
      )}
    </View>
  );
}
