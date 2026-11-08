import { View } from 'react-native';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { C } from '@/components/ui';
import { PIN_COLORS, type LiveMapProps } from './types';
import { FitTo, MAPS_KEY, NoKey, dot } from './web-map';

export function LiveMap({ points, height = 240 }: LiveMapProps) {
  if (!MAPS_KEY) return <NoKey height={height} />;
  const first = points[0];
  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
      <APIProvider apiKey={MAPS_KEY}>
        <Map
          style={{ width: '100%', height: '100%' }}
          defaultCenter={first ?? { lat: 6.7148, lng: 80.7871 }}
          defaultZoom={15}
          gestureHandling="cooperative"
          disableDefaultUI
          zoomControl
          clickableIcons={false}
        >
          {points.map((p) => (
            <Marker
              key={p.id}
              position={p}
              title={p.title}
              icon={dot(PIN_COLORS[p.kind], p.kind === 'rider' ? 10 : 9)}
              onClick={p.onPress}
            />
          ))}
          <FitTo points={points} />
        </Map>
      </APIProvider>
    </View>
  );
}
