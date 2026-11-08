import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from './supabase';

export type ShareState = 'off' | 'asking' | 'denied' | 'sharing' | 'error';

/** Turns a failed location upload into a message that says what actually went wrong. */
function describeError(error: { message?: string; code?: string } | null | undefined): string {
  const msg = error?.message ?? '';
  if (error?.code === 'PGRST202' || /could not find the function/i.test(msg)) {
    return 'Live tracking is not set up on the server yet (ask admin)';
  }
  if (/NB_FORBIDDEN/.test(msg)) return 'Your rider account is inactive — contact admin';
  if (/NB_LOCATION_REQUIRED/.test(msg)) return 'Your location looks outside Sri Lanka';
  if (/network|fetch|timeout/i.test(msg)) return 'Could not share location — check your connection';
  return msg ? `Could not share location: ${msg}` : 'Could not share location';
}

/**
 * While `active` (the rider has orders to pick up or deliver), watch the phone's GPS and
 * send the position to the server, which pushes it to customers whose food is on the way.
 * Foreground only: in Expo Go this runs while the app is open.
 */
/** Shared across screens so two watchers never upload twice. */
let lastSent = 0;

export function useShareLocation(active: boolean, { fast = false }: { fast?: boolean } = {}) {
  const [state, setState] = useState<ShareState>('off');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);

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
          // While navigating, update the map every ~2 s; otherwise every ~10 s.
          fast
            ? {
                accuracy: Location.Accuracy.BestForNavigation,
                timeInterval: 2000,
                distanceInterval: 5,
              }
            : { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 25 },
          (loc) => {
            const { latitude, longitude, heading, speed, accuracy } = loc.coords;
            setPosition({ lat: latitude, lng: longitude });
            setHeading(heading != null && heading >= 0 ? heading : null);
            const now = Date.now();
            // Customers get an update at most every ~5 s (keeps traffic and battery low).
            if (now - lastSent < 5000) return;
            lastSent = now;
            supabase
              .rpc('rider_update_location', {
                p_lat: latitude,
                p_lng: longitude,
                p_heading: heading ?? undefined,
                p_speed: speed ?? undefined,
                p_accuracy: accuracy ?? undefined,
              })
              .then(({ error }) => {
                setState(error ? 'error' : 'sharing');
                setErrorText(error ? describeError(error) : null);
              });
          },
        );
        if (cancelled) sub.remove();
        else setState('sharing');
      } catch {
        if (!cancelled) {
          setState('error');
          setErrorText('Could not read your GPS — check that location is turned on');
        }
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [active, fast]);

  return { state, position, heading, errorText };
}
