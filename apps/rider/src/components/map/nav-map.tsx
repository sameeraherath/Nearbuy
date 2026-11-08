import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { LatLng } from '@/lib/geo';
import { C, T } from '@/components/ui';
import { PIN_COLORS } from './types';

/**
 * Full-screen navigation map: the camera follows the rider (tilted, rotated to their heading)
 * until they pan the map; "Re-center" resumes following.
 */
export function NavMap({
  rider,
  heading,
  destination,
  route,
  routeIsEstimate,
  bottomInset = 0,
}: {
  rider: LatLng | null;
  heading: number | null;
  destination: LatLng;
  route?: LatLng[];
  routeIsEstimate?: boolean;
  bottomInset?: number;
}) {
  const ref = useRef<MapView>(null);
  const [following, setFollowing] = useState(true);

  useEffect(() => {
    if (!following || !rider) return;
    ref.current?.animateCamera(
      {
        center: { latitude: rider.lat, longitude: rider.lng },
        heading: heading ?? 0,
        pitch: 45,
        zoom: 17,
      },
      { duration: 800 },
    );
  }, [following, rider?.lat, rider?.lng, heading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: rider?.lat ?? destination.lat,
          longitude: rider?.lng ?? destination.lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        mapPadding={{ top: 0, right: 0, bottom: bottomInset, left: 0 }}
        onPanDrag={() => setFollowing(false)}
      >
        {route && route.length > 1 && (
          <Polyline
            coordinates={route.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor="#1A73E8"
            strokeWidth={7}
            lineDashPattern={routeIsEstimate ? [14, 10] : undefined}
          />
        )}
        <Marker
          coordinate={{ latitude: destination.lat, longitude: destination.lng }}
          pinColor={PIN_COLORS.stop}
          title="Drop-off"
        />
      </MapView>
      {!following && (
        <Pressable
          onPress={() => setFollowing(true)}
          style={{
            position: 'absolute',
            right: 16,
            bottom: bottomInset + 16,
            backgroundColor: C.surface,
            borderRadius: 999,
            paddingHorizontal: 16,
            height: 44,
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: C.border,
            elevation: 3,
          }}
        >
          <T bold>◎ Re-center</T>
        </Pressable>
      )}
    </View>
  );
}
