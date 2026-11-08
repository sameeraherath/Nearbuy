import { useEffect, useRef, useState } from 'react';
import { decodePolyline, distanceMeters, etaMinutes, type LatLng } from './geo';

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
/** Refetch the road route only after this much movement or time (keeps Google costs low). */
const REFETCH_METERS = 150;
const REFETCH_MS = 90_000;

export interface Route {
  points: LatLng[];
  meters: number;
  seconds: number;
}

let travelMode: 'TWO_WHEELER' | 'DRIVE' = 'TWO_WHEELER';

/** Road route from Google Routes API. Returns null when there is no key or the API fails. */
export async function fetchRoute(from: LatLng, to: LatLng): Promise<Route | null> {
  if (!KEY) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': KEY,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
          destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
          travelMode,
        }),
      });
      if (!res.ok) {
        // Two-wheeler routing isn't available everywhere; fall back to driving once.
        if (travelMode === 'TWO_WHEELER') {
          travelMode = 'DRIVE';
          continue;
        }
        return null;
      }
      const json = (await res.json()) as {
        routes?: { duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }[];
      };
      const r = json.routes?.[0];
      if (!r?.polyline?.encodedPolyline) return null;
      return {
        points: decodePolyline(r.polyline.encodedPolyline),
        meters: r.distanceMeters ?? 0,
        seconds: Number.parseInt(r.duration ?? '0', 10) || 0,
      };
    } catch {
      return null;
    }
  }
  return null;
}

export interface LiveRoute {
  /** Road path, or a straight line when no road route is available. */
  points: LatLng[];
  meters: number;
  minutes: number;
  /** true when the line follows real roads (Google Routes API). */
  onRoads: boolean;
}

/**
 * Keeps a route from a moving point (the rider) to a fixed destination. Refetches the road
 * route only when the rider has moved ~150 m or 90 s have passed; between fetches the
 * distance and time are scaled to the rider's current position.
 */
export function useLiveRoute(from: LatLng | null, to: LatLng | null): LiveRoute | null {
  const [route, setRoute] = useState<Route | null>(null);
  const anchor = useRef<{ from: LatLng; at: number; to: string } | null>(null);
  const busy = useRef(false);
  const toKey = to ? `${to.lat.toFixed(5)},${to.lng.toFixed(5)}` : '';

  useEffect(() => {
    if (!from || !to || busy.current) return;
    const a = anchor.current;
    const stale =
      !a ||
      a.to !== toKey ||
      distanceMeters(a.from, from) > REFETCH_METERS ||
      Date.now() - a.at > REFETCH_MS;
    if (!stale) return;
    busy.current = true;
    anchor.current = { from, at: Date.now(), to: toKey };
    fetchRoute(from, to)
      .then((r) => setRoute(r))
      .finally(() => {
        busy.current = false;
      });
  }, [from?.lat, from?.lng, toKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!from || !to) return null;
  const straight = distanceMeters(from, to);

  if (route && anchor.current) {
    // Scale the last road route to how far the rider still is (straight-line ratio).
    const startStraight = Math.max(1, distanceMeters(anchor.current.from, to));
    const ratio = Math.min(1.5, straight / startStraight);
    // Trim the drawn path so it starts at the point closest to the rider.
    let nearest = 0;
    let best = Infinity;
    route.points.forEach((p, i) => {
      const d = distanceMeters(p, from);
      if (d < best) {
        best = d;
        nearest = i;
      }
    });
    return {
      points: [from, ...route.points.slice(nearest + 1)],
      meters: Math.round(route.meters * ratio),
      minutes: Math.max(1, Math.round((route.seconds * ratio) / 60)),
      onRoads: true,
    };
  }

  return { points: [from, to], meters: Math.round(straight * 1.4), minutes: etaMinutes(from, to), onRoads: false };
}
