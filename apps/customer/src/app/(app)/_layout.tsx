import { Stack } from 'expo-router';
import { COLORS } from '@nearbuy/shared';

// Every screen draws its own <AppBar> (components/layout.tsx) so headers line up with the
// centred content column on tablets and in the browser.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }} />;
}
