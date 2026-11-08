export interface LatLng {
  lat: number;
  lng: number;
}

/** Straight-line distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rough arrival time: road distance ≈ 1.4 × straight line, bike/scooter ≈ 20 km/h. */
export function etaMinutes(from: LatLng, to: LatLng): number {
  const roadMeters = distanceMeters(from, to) * 1.4;
  return Math.max(1, Math.round(roadMeters / ((20 * 1000) / 60)));
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
}

/** Map centre when nothing else is known: Sabaragamuwa University, Belihuloya. */
export const CAMPUS: LatLng = { lat: 6.7148, lng: 80.7871 };

/** Same bounds the server enforces in place_order. */
export function inSriLanka(p: LatLng): boolean {
  return p.lat >= 5.8 && p.lat <= 10 && p.lng >= 79.4 && p.lng <= 82;
}

/** Decodes a Google encoded polyline into points. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of ['lat', 'lng'] as const) {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 'lat') lat += delta;
      else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
