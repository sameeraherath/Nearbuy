import { Stack } from 'expo-router';
import { COLORS } from '@nearbuy/shared';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTransparent: false,
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: COLORS.background, width: '100%', maxWidth: 720, alignSelf: 'center' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Nearbuy' }} />
      <Stack.Screen name="shop/[id]" options={{ title: '' }} />
      <Stack.Screen name="cart" options={{ title: 'Your order' }} />
      <Stack.Screen name="orders" options={{ title: 'My orders' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
    </Stack>
  );
}
