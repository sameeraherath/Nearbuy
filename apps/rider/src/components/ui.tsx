import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { COLORS, RADII, SIZES, type OrderStatus } from '@nearbuy/shared';

export const C = COLORS;

export function T({
  children,
  style,
  muted,
  bold,
  size = 15,
  numberOfLines,
}: PropsWithChildren<{ style?: StyleProp<TextStyle>; muted?: boolean; bold?: boolean; size?: number; numberOfLines?: number }>) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { color: muted ? C.textSecondary : C.text, fontSize: size, fontWeight: bold ? '700' : '400' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? C.primary : C.surface;
  const fg = variant === 'danger' ? C.error : C.onPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: pressed && variant === 'primary' ? C.primaryPressed : bg },
        variant !== 'primary' && { borderWidth: 1, borderColor: variant === 'danger' ? C.error : C.border },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[s.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label && <T size={13} muted>{label}</T>}
      <TextInput placeholderTextColor="#8D9096" style={[s.input, style]} {...rest} />
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <ActivityIndicator color={C.primary} size="large" />
    </View>
  );
}

export function ErrorText({ children }: PropsWithChildren) {
  if (!children) return null;
  return <T style={{ color: C.error }} size={14}>{children}</T>;
}

export function Banner({ tone, children }: { tone: 'info' | 'warn' | 'ok'; children: ReactNode }) {
  const bg = tone === 'warn' ? '#FDECEA' : tone === 'ok' ? '#E8F5E9' : C.primaryTint;
  return <View style={[s.banner, { backgroundColor: bg }]}>{children}</View>;
}

const STATUS: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  placed: { label: 'Placed', bg: C.primaryTint, fg: '#8A5300' },
  assigned: { label: 'Rider assigned', bg: '#E8F0FE', fg: '#1A4FA0' },
  picked_up: { label: 'On the way', bg: '#F3E8FD', fg: '#6A1B9A' },
  delivered: { label: 'Delivered', bg: '#E8F5E9', fg: C.success },
  cancelled: { label: 'Cancelled', bg: '#FDECEA', fg: C.error },
};

export function StatusPill({ status }: { status: OrderStatus }) {
  const st = STATUS[status];
  return (
    <View style={{ backgroundColor: st.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: st.fg, fontSize: 12, fontWeight: '700' }}>{st.label}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  content: { padding: SIZES.screenMargin, gap: 12 },
  card: {
    backgroundColor: C.surface,
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  button: {
    height: SIZES.buttonHeight,
    borderRadius: RADII.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonText: { fontSize: 17, fontWeight: '700' },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    fontSize: 17,
    color: C.text,
  },
  banner: { borderRadius: 12, padding: 12, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
