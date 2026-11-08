import { Pressable, SectionList, View } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { formatRs, STORAGE_BUCKETS } from '@nearbuy/shared';
import { photoUrl, supabase } from '@/lib/supabase';
import { fetchSettings, useFocusedQuery } from '@/lib/data';
import { useCart } from '@/lib/cart';
import { Banner, Button, C, Card, ErrorText, Loading, T, s } from '@/components/ui';
import { Stepper } from '@/components/stepper';

export default function ShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cart = useCart();
  const { data, error, loading } = useFocusedQuery(async () => {
    const [shop, foods, settings] = await Promise.all([
      supabase.from('shops').select('*').eq('id', id).maybeSingle(),
      supabase.from('menu_foods').select('*').eq('business_id', id).order('category').order('sort_order').order('name'),
      fetchSettings(),
    ]);
    if (shop.error) throw shop.error;
    if (foods.error) throw foods.error;
    return { shop: shop.data, foods: foods.data, settings };
  }, [id]);

  if (loading && !data) return <Loading />;
  const shop = data?.shop;
  if (!shop) return <View style={s.content}><ErrorText>{error ?? 'This shop is not available.'}</ErrorText></View>;

  const sections = Object.entries(
    (data.foods ?? []).reduce<Record<string, typeof data.foods>>((acc, f) => {
      (acc[f.category ?? 'Other'] ??= []).push(f);
      return acc;
    }, {}),
  ).map(([title, items]) => ({ title, data: items }));

  const otherShopInCart = cart.shopId && cart.shopId !== shop.id;
  const open = data.settings?.is_open ?? false;

  return (
    <View style={s.screen}>
      <Stack.Screen options={{ title: shop.name ?? '' }} />
      <SectionList
        sections={sections}
        keyExtractor={(f) => f.id!}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[s.content, { paddingBottom: 120 }]}
        ListHeaderComponent={
          <View style={{ gap: 8 }}>
            <T muted>{[shop.area, ...(shop.cuisine_tags ?? [])].filter(Boolean).join(' · ')}</T>
            {!open && (
              <Banner tone="warn">
                <T bold>Orders are closed for today</T>
                <T muted size={14}>You can look at the menu, but ordering opens again tomorrow.</T>
              </Banner>
            )}
            {otherShopInCart && (
              <Banner tone="info">
                <T size={14}>
                  Your cart has food from {cart.shopName}. Adding from here starts a new cart (one shop per order).
                </T>
              </Banner>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <T size={18} bold style={{ marginTop: 12 }}>
            {section.title}
          </T>
        )}
        renderItem={({ item }) => {
          const qty = cart.shopId === shop.id ? cart.qtyOf(item.id!) : 0;
          const img = photoUrl(STORAGE_BUCKETS.foodPhotos, item.photo_path);
          const available = !!item.is_available;
          return (
            <Card style={[{ flexDirection: 'row', gap: 12, alignItems: 'center' }, !available && { opacity: 0.5 }]}>
              {img && <Image source={img} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" />}
              <View style={{ flex: 1, gap: 2 }}>
                <T bold>{item.name}</T>
                {!!item.description && (
                  <T muted size={13} numberOfLines={2}>
                    {item.description}
                  </T>
                )}
                <T bold style={{ color: C.text }}>
                  {formatRs(item.selling_price ?? 0)}
                </T>
              </View>
              {!available ? (
                <T muted size={13}>Sold out</T>
              ) : qty === 0 ? (
                <Pressable
                  disabled={!open}
                  onPress={() =>
                    cart.add(
                      { id: shop.id!, name: shop.name! },
                      { id: item.id!, name: item.name!, price: item.selling_price! },
                    )
                  }
                  style={[addStyle, !open && { opacity: 0.4 }]}
                >
                  <T bold>Add</T>
                </Pressable>
              ) : (
                <Stepper qty={qty} onChange={(n) => cart.setQty(item.id!, n)} />
              )}
            </Card>
          );
        }}
      />
      {cart.count > 0 && cart.shopId === shop.id && (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 24 }}>
          <Button title={`View cart · ${cart.count} item${cart.count > 1 ? 's' : ''}`} onPress={() => router.push('/cart')} />
        </View>
      )}
    </View>
  );
}

const addStyle = {
  backgroundColor: C.primary,
  borderRadius: 12,
  paddingHorizontal: 18,
  height: 44,
  justifyContent: 'center' as const,
};
