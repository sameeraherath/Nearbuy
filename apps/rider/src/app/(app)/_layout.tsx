import { Stack } from 'expo-router';
import { COLORS } from '@nearbuy/shared';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.navy },
        headerTransparent: false,
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Today's run" }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Delivery' }} />
    </Stack>
  );
}
