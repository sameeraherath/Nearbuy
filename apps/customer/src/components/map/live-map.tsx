import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { C } from '@/components/ui';
import { PIN_COLORS, type LiveMapProps } from './types';

/** Read-only map that keeps all points in view. */
export function LiveMap({ points, height = 220, showsUserLocation }: LiveMapProps) {
  const ref = useRef<MapView>(null);
  const key = points.map((p) => `${p.id}:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      ref.current?.animateToRegion(
        { latitude: points[0]!.lat, longitude: points[0]!.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 },
        300,
      );
      return;
    }
    ref.current?.fitToCoordinates(
      points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const first = points[0];
  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={
          first
            ? { latitude: first.lat, longitude: first.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
            : undefined
        }
        showsUserLocation={showsUserLocation}
        toolbarEnabled={false}
      >
        {points.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.title}
            pinColor={PIN_COLORS[p.kind]}
            onCalloutPress={p.onPress}
          />
        ))}
      </MapView>
    </View>
  );
}
