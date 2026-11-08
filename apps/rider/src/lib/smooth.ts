import { useEffect, useRef, useState } from 'react';
import type { LatLng } from './geo';

/** Glides a marker from its old position to a new one instead of jumping. */
export function useSmoothPosition(target: LatLng | null, durationMs = 1200): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(target);
  const current = useRef<LatLng | null>(target);

  useEffect(() => {
    if (!target) {
      current.current = null;
      setPos(null);
      return;
    }
    const from = current.current;
    if (!from) {
      current.current = target;
      setPos(target);
      return;
    }
    let frame = 0;
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / durationMs);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in-out
      const p = {
        lat: from.lat + (target.lat - from.lat) * e,
        lng: from.lng + (target.lng - from.lng) * e,
      };
      current.current = p;
      setPos(p);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target?.lat, target?.lng, durationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return pos;
}
