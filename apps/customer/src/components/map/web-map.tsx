// Web-only helpers shared by the .web.tsx map components (Google Maps JavaScript API).
import { useEffect, useRef } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { View } from 'react-native';
import { C, T } from '@/components/ui';
import type { LatLng } from '@/lib/geo';

export const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/** A coloured dot marker (no Map ID needed). path 0 = google.maps.SymbolPath.CIRCLE */
export function dot(color: string, scale = 9) {
  return { path: 0, scale, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 };
}

export function PanTo({ to }: { to: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map?.panTo(to);
  }, [map, to.lat, to.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function FitTo({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      map.panTo(points[0]!);
      map.setZoom(16);
      return;
    }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.fitBounds(
      { north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lngs), west: Math.min(...lngs) },
      60,
    );
  }, [map, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function NoKey({ height }: { height: number }) {
  return (
    <View
      style={{
        height,
        borderRadius: 12,
        backgroundColor: C.primaryTint,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <T muted size={13} style={{ textAlign: 'center' }}>
        Map unavailable: set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
      </T>
    </View>
  );
}

interface GPolyline {
  setMap(map: unknown): void;
  setPath(path: LatLng[]): void;
  setOptions(opts: Record<string, unknown>): void;
}
type GoogleNS = { maps: { Polyline: new (opts: Record<string, unknown>) => GPolyline } };

/** Route line on the web map (Google Maps JS has no React component for polylines). */
export function RouteLine({ points, dashed }: { points: LatLng[]; dashed?: boolean }) {
  const map = useMap();
  const line = useRef<GPolyline | null>(null);

  useEffect(() => {
    const g = (globalThis as { google?: GoogleNS }).google;
    if (!map || !g) return;
    line.current = new g.maps.Polyline({ map, strokeColor: '#232F3E', strokeWeight: 5, strokeOpacity: 0.9 });
    return () => {
      line.current?.setMap(null);
      line.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (!line.current) return;
    line.current.setPath(points);
    line.current.setOptions(
      dashed
        ? {
            strokeOpacity: 0,
            icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '14px' }],
          }
        : { strokeOpacity: 0.9, icons: [] },
    );
  }, [points, dashed]);

  return null;
}
