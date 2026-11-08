import { Pressable, View } from 'react-native';
import { C, T, s } from './ui';

export function Stepper({ qty, onChange }: { qty: number; onChange: (n: number) => void }) {
  return (
    <View style={[s.row, { gap: 0 }]}>
      <Pressable onPress={() => onChange(qty - 1)} style={step} hitSlop={6}>
        <T size={20} bold>−</T>
      </Pressable>
      <T bold style={{ minWidth: 28, textAlign: 'center' }}>
        {qty}
      </T>
      <Pressable onPress={() => onChange(qty + 1)} style={[step, { backgroundColor: C.primary }]} hitSlop={6}>
        <T size={20} bold>+</T>
      </Pressable>
    </View>
  );
}

const step = {
  width: 40,
  height: 40,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: C.border,
  backgroundColor: C.surface,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};
