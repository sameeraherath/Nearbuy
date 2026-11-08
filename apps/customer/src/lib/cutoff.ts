import { colomboClock, timeToSeconds } from '@nearbuy/shared';

/** "Closes in 2 h 15 min" when the cutoff is less than 4 hours away, otherwise null. */
export function closesIn(cutoff: string, now: Date = new Date()): string | null {
  const left = timeToSeconds(cutoff) - timeToSeconds(colomboClock(now).time);
  if (left <= 0 || left > 4 * 3600) return null;
  const h = Math.floor(left / 3600);
  const m = Math.max(1, Math.round((left % 3600) / 60));
  return h > 0 ? `Closes in ${h} h ${m} min` : `Closes in ${m} min`;
}
