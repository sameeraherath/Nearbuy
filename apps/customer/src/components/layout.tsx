import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, T } from './ui';

/** Width of the content column on tablets and desktop browsers. */
export const MAX_WIDTH = 760;

export const column: ViewStyle = { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' };

export function Brand({ size = 22 }: { size?: number }) {
  return (
    <T size={size} bold style={{ letterSpacing: -0.5 }}>
      near
      <T size={size} bold style={{ color: C.primary }}>
        buy
      </T>
    </T>
  );
}

/**
 * Top bar used by every customer screen. Its content is centred to the same column as the
 * page, so the title and buttons line up with the cards on wide screens.
 */
export function AppBar({
  title,
  subtitle,
  right,
  back = true,
  brand = false,
  maxWidth = MAX_WIDTH,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  back?: boolean;
  brand?: boolean;
  maxWidth?: number;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: C.surface,
        paddingTop: insets.top,
        borderBottomWidth: 1,
        borderColor: C.border,
      }}
    >
      <View
        style={{
          minHeight: 60,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          width: '100%',
          maxWidth,
          alignSelf: 'center',
        }}
      >
        {back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: -8,
              backgroundColor: pressed ? C.background : 'transparent',
            })}
          >
            <T size={24} bold>
              ←
            </T>
          </Pressable>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {brand ? (
            <Brand />
          ) : (
            <T size={18} bold numberOfLines={1}>
              {title}
            </T>
          )}
          {!!subtitle && (
            <T size={13} muted numberOfLines={1}>
              {subtitle}
            </T>
          )}
        </View>
        {right}
      </View>
    </View>
  );
}

/** Small pill button for the app bar (e.g. "My orders"). */
export function BarButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        backgroundColor: pressed ? C.primaryPressed : C.primaryTint,
      })}
    >
      <T size={14} bold style={{ color: '#8A5300' }}>
        {label}
      </T>
    </Pressable>
  );
}

/** Floating bottom action (e.g. "View cart"), centred and above the home indicator. */
export function BottomBar({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[
        { position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 12) + 8 },
        style,
      ]}
    >
      <View style={[column, { paddingHorizontal: 16 }]}>{children}</View>
    </View>
  );
}
