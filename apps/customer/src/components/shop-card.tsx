import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { STORAGE_BUCKETS } from '@nearbuy/shared';
import { photoUrl } from '@/lib/supabase';
import { C, T } from './ui';

const TINTS = ['#FFF4E0', '#E8F0FE', '#E8F5E9', '#F3E8FD', '#FDECEA'];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w[0] ?? ''))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function ShopCard({
  shop,
  onPress,
}: {
  shop: {
    id: string;
    name: string;
    area: string | null;
    cuisine_tags: string[] | null;
    cover_photo_path: string | null;
  };
  onPress: () => void;
}) {
  const cover = photoUrl(STORAGE_BUCKETS.businessCovers, shop.cover_photo_path);
  const tint = TINTS[[...shop.id].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length]!;
  const tags = shop.cuisine_tags ?? [];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: C.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: pressed ? C.primary : C.border,
        overflow: 'hidden',
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      {cover && (
        <Image source={cover} style={{ height: 140 }} contentFit="cover" transition={150} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        {!cover && (
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: tint,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T size={18} bold style={{ color: C.navy }}>
              {initials(shop.name)}
            </T>
          </View>
        )}
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <T size={17} bold numberOfLines={1}>
            {shop.name}
          </T>
          {!!shop.area && (
            <T muted size={13} numberOfLines={1}>
              📍 {shop.area}
            </T>
          )}
          {tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {tags.slice(0, 3).map((t) => (
                <View
                  key={t}
                  style={{
                    backgroundColor: C.background,
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <T size={12} muted>
                    {t}
                  </T>
                </View>
              ))}
            </View>
          )}
        </View>
        <T size={20} muted>
          ›
        </T>
      </View>
    </Pressable>
  );
}
