import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { COLORS } from '@nearbuy/shared';
import { SessionProvider, useSession } from '@/lib/session';
import { CartProvider } from '@/lib/cart';

SplashScreen.preventAutoHideAsync();

export default function Root() {
  return (
    <SessionProvider>
      <CartProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </CartProvider>
    </SessionProvider>
  );
}

// No sign-in wall: anyone can browse shops and build a cart. The mobile number is
// confirmed as the last step of checkout (cart) or when opening "My orders".
function RootNavigator() {
  const { isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }}>
      <Stack.Screen name="(app)" />
    </Stack>
  );
}
