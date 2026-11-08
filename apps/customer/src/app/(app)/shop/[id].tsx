import { Pressable, SectionList, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatRs, STORAGE_BUCKETS, type Tables } from '@nearbuy/shared';
import { photoUrl, supabase } from '@/lib/supabase';
import { fetchSettings, useFocusedQuery } from '@/lib/data';
import { useCart } from '@/lib/cart';
import { AppBar, BottomBar } from '@/components/layout';
import { Stepper } from '@/components/stepper';
import { Banner, Button, C, ErrorText, Loading, T, s } from '@/components/ui';

type Food = Tables<'menu_foods'>;

/** Categories with something to order come first; sold-out items go to the bottom of each. */
function toSections(foods: Food[]) {
  const groups = new Map<string, Food[]>();
  for (const f of foods) {
    const key = f.category ?? 'Other';
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups.entries()]
    .map(([title, items]) => ({
      title,
      available: items.some((i) => i.is_available),
      data: [...items].sort((a, b) => Number(!!b.is_available) - Number(!!a.is_available)),
    }))
    .sort((a, b) => Number(b.available) - Number(a.available));
}

export default function ShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cart = useCart();
  const { data, error, loading } = useFocusedQuery(async () => {
    const [shop, foods, settings] = await Promise.all([
      supabase.from('shops').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('menu_foods')
        .select('*')
        .eq('business_id', id)
        .order('sort_order')
        .order('name'),
      fetchSettings(),
    ]);
    if (shop.error) throw shop.error;
    if (foods.error) throw foods.error;
    return { shop: shop.data, foods: foods.data, settings };
  }, [id]);

  const shop = data?.shop;
  const open = data?.settings?.is_open ?? false;
  const inThisShop = cart.shopId === shop?.id;
  const cartTotal = cart.lines.reduce((n, l) => n + l.price * l.qty, 0);
  const cover = photoUrl(STORAGE_BUCKETS.businessCovers, shop?.cover_photo_path);

  return (
    <View style={s.screen}>
      <AppBar
        title={shop?.name ?? 'Menu'}
        subtitle={
          shop ? [shop.area, ...(shop.cuisine_tags ?? [])].filter(Boolean).join(' · ') : undefined
        }
      />
      {loading && !data ? (
        <Loading />
      ) : !shop ? (
        <View style={s.content}>
          <ErrorText>{error ?? 'This shop is not available right now.'}</ErrorText>
          <Button title="Back to shops" variant="secondary" onPress={() => router.replace('/')} />
        </View>
      ) : (
        <SectionList
          sections={toSections(data.foods ?? [])}
          keyExtractor={(f) => f.id!}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[s.content, { paddingBottom: cart.count > 0 ? 120 : 32 }]}
          ListHeaderComponent={
            !cover && open && !(cart.shopId && !inThisShop) ? undefined : (
              <View style={{ gap: 10 }}>
                {cover && (
                  <Image
                    source={cover}
                    style={{ height: 160, borderRadius: 16 }}
                    contentFit="cover"
                    transition={150}
                  />
                )}
                {!open && (
                  <Banner tone="warn">
                    <T bold>Orders are closed for today</T>
                    <T muted size={14}>
                      You can look at the menu; ordering opens again tomorrow.
                    </T>
                  </Banner>
                )}
                {cart.shopId && !inThisShop && (
                  <Banner tone="info">
                    <T size={14}>
                      Your cart has food from{' '}
                      <T bold size={14}>
                        {cart.shopName}
                      </T>
                      . One shop per order, so adding from here starts a new cart.
                    </T>
                  </Banner>
                )}
              </View>
            )
          }
          renderSectionHeader={({ section }) => (
            <T size={18} bold style={{ marginTop: 6, marginBottom: 2 }}>
              {section.title}
            </T>
          )}
          ListEmptyComponent={<T muted>This shop has no menu yet.</T>}
          renderItem={({ item }) => (
            <FoodRow
              food={item}
              qty={inThisShop ? cart.qtyOf(item.id!) : 0}
              canOrder={open}
              onAdd={() =>
                cart.add(
                  { id: shop.id!, name: shop.name! },
                  { id: item.id!, name: item.name!, price: item.selling_price! },
                )
              }
              onQty={(n) => cart.setQty(item.id!, n)}
            />
          )}
        />
      )}
      {cart.count > 0 && inThisShop && (
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

function FoodRow({
  food,
  qty,
  canOrder,
  onAdd,
  onQty,
}: {
  food: Food;
  qty: number;
  canOrder: boolean;
  onAdd: () => void;
  onQty: (n: number) => void;
}) {
  const img = photoUrl(STORAGE_BUCKETS.foodPhotos, food.photo_path);
  const available = !!food.is_available;
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center',
          backgroundColor: C.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: qty > 0 ? C.primary : C.border,
          padding: 12,
        },
        !available && { opacity: 0.55 },
      ]}
    >
      {img && (
        <Image
          source={img}
          style={{ width: 72, height: 72, borderRadius: 12 }}
          contentFit="cover"
          transition={150}
        />
      )}
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <T bold>{food.name}</T>
        {!!food.description && (
          <T muted size={13} numberOfLines={2}>
            {food.description}
          </T>
        )}
        <T bold style={{ marginTop: 2 }}>
          {formatRs(food.selling_price ?? 0)}
        </T>
      </View>
      {!available ? (
        <View
          style={{
            backgroundColor: C.background,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <T muted size={12} bold>
            Sold out
          </T>
        </View>
      ) : qty === 0 ? (
        <Pressable
          disabled={!canOrder}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={`Add ${food.name}`}
          style={({ pressed }) => ({
            backgroundColor: pressed ? C.primaryPressed : C.primary,
            borderRadius: 12,
            paddingHorizontal: 18,
            height: 44,
            justifyContent: 'center',
            opacity: canOrder ? 1 : 0.4,
          })}
        >
          <T bold>Add</T>
        </Pressable>
      ) : (
        <Stepper qty={qty} onChange={onQty} />
      )}
    </View>
  );
}
