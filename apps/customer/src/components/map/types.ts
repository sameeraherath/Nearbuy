import type { LatLng } from '@/lib/geo';

export interface LocationPickerProps {
  value: LatLng;
  onChange: (p: LatLng) => void;
  height?: number;
}

export interface MapPoint extends LatLng {
  id: string;
  kind: 'home' | 'rider' | 'stop';
  title?: string;
  onPress?: () => void;
}

export interface LiveMapProps {
  points: MapPoint[];
  height?: number;
  /** Show the device's own blue dot (native only). */
  showsUserLocation?: boolean;
}

export const PIN_COLORS: Record<MapPoint['kind'], string> = {
  home: '#FF9900',
  rider: '#232F3E',
  stop: '#D13212',
};
