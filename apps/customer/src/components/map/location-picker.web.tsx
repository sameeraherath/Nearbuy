import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { inSriLanka } from '@/lib/geo';
import { C, T } from '@/components/ui';
import { PIN_COLORS, type LocationPickerProps } from './types';
import { MAPS_KEY, NoKey, PanTo, dot } from './web-map';

export function LocationPicker({ value, onChange, height = 260 }: LocationPickerProps) {
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function useMyLocation() {
    setError(null);
    if (!navigator.geolocation) return setError('Location is not available in this browser');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!inSriLanka(p)) return setError('Your location is outside Sri Lanka');
        onChange(p);
      },
      () => {
        setLocating(false);
        setError('Could not get your location');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  if (!MAPS_KEY) return <NoKey height={height} />;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ height, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
        <APIProvider apiKey={MAPS_KEY}>
          <Map
            style={{ width: '100%', height: '100%' }}
            defaultCenter={value}
            defaultZoom={16}
            gestureHandling="greedy"
            disableDefaultUI
            zoomControl
            clickableIcons={false}
            onClick={(e) => {
              const p = e.detail.latLng;
              if (p) onChange({ lat: p.lat, lng: p.lng });
            }}
          >
            <Marker
              position={value}
              draggable
              icon={dot(PIN_COLORS.home, 11)}
              onDragEnd={(e) => {
                if (e.latLng) onChange({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }}
            />
            <PanTo to={value} />
          </Map>
        </APIProvider>
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
      <T muted size={12}>Click the map or drag the pin to the exact drop-off spot.</T>
      {error && <T size={13} style={{ color: C.error }}>{error}</T>}
    </View>
  );
}
