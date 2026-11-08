import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from './supabase';

export type ShareState = 'off' | 'asking' | 'denied' | 'sharing' | 'error';

/**
 * While `active` (the rider has orders to pick up or deliver), watch the phone's GPS and
 * send the position to the server, which pushes it to customers whose food is on the way.
 * Foreground only: in Expo Go this runs while the app is open.
 */
export function useShareLocation(active: boolean) {
  const [state, setState] = useState<ShareState>('off');
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!active) {
      setState('off');
      return;
    }
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      setState('asking');
      const perm = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (perm.status !== 'granted') {
        setState('denied');
        return;
      }
      try {
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 25 },
          (loc) => {
            const { latitude, longitude, heading, speed, accuracy } = loc.coords;
            setPosition({ lat: latitude, lng: longitude });
            const now = Date.now();
            if (now - lastSent.current < 8000) return; // at most one update every ~8 s
            lastSent.current = now;
            supabase
              .rpc('rider_update_location', {
                p_lat: latitude,
                p_lng: longitude,
                p_heading: heading ?? undefined,
                p_speed: speed ?? undefined,
                p_accuracy: accuracy ?? undefined,
              })
              .then(({ error }) => setState(error ? 'error' : 'sharing'));
          },
        );
        if (cancelled) sub.remove();
        else setState('sharing');
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [active]);

  return { state, position };
}
