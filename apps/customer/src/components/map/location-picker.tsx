import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { inSriLanka } from '@/lib/geo';
import { C, T } from '@/components/ui';
import { PIN_COLORS, type LocationPickerProps } from './types';

const DELTA = { latitudeDelta: 0.008, longitudeDelta: 0.008 };

/** Map with a draggable pin. Tap the map or drag the pin to choose the delivery spot. */
export function LocationPicker({ value, onChange, height = 220 }: LocationPickerProps) {
  const ref = useRef<MapView>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.animateToRegion({ latitude: value.lat, longitude: value.lng, ...DELTA }, 300);
  }, [value.lat, value.lng]);

  async function useMyLocation() {
    setError(null);
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return setError('Location permission was denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!inSriLanka(p)) return setError('Your location is outside Sri Lanka');
      onChange(p);
    } catch {
      setError('Could not get your location');
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={{ height, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
        <MapView
          ref={ref}
          style={{ flex: 1 }}
          initialRegion={{ latitude: value.lat, longitude: value.lng, ...DELTA }}
          onPress={(e) => onChange({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
          showsUserLocation
          toolbarEnabled={false}
        >
          <Marker
            coordinate={{ latitude: value.lat, longitude: value.lng }}
            draggable
            pinColor={PIN_COLORS.home}
            onDragEnd={(e) =>
              onChange({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })
            }
          />
        </MapView>
        <Pressable
          onPress={useMyLocation}
          disabled={locating}
          style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            backgroundColor: C.surface,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: C.border,
          }}
        >
          <T size={13} bold>{locating ? 'Finding you…' : '◎ Use my location'}</T>
        </Pressable>
      </View>
      <T muted size={12}>Tap the map or drag the pin to the exact drop-off spot.</T>
      {error && <T size={13} style={{ color: C.error }}>{error}</T>}
    </View>
  );
}
