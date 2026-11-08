import { TIMEZONE } from './constants';

export interface ColomboClock {
  /** YYYY-MM-DD in Asia/Colombo */
  date: string;
  /** HH:MM:SS in Asia/Colombo */
  time: string;
}

const formatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function colomboClock(now: Date = new Date()): ColomboClock {
  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}

export function colomboDate(now: Date = new Date()): string {
  return colomboClock(now).date;
}

/** Normalise "18:00" / "18:00:00" to seconds since midnight. */
export function timeToSeconds(time: string): number {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(time);
  if (!match) throw new RangeError(`Invalid time: ${time}`);
  const [, h, m, s] = match;
  const hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s ?? 0);
  if (hours > 23 || minutes > 59 || seconds > 59) throw new RangeError(`Invalid time: ${time}`);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Mirrors the server rule: ordering is open only when enabled and the current Colombo
 * time is strictly before the cutoff. The server is the source of truth; use this for UI only.
 */
export function isOrderingOpen(
  settings: { cutoff_time: string; ordering_enabled: boolean },
  now: Date = new Date(),
): boolean {
  if (!settings.ordering_enabled) return false;
  return timeToSeconds(colomboClock(now).time) < timeToSeconds(settings.cutoff_time);
}

/** "18:00:00" → "6:00 PM" */
export function formatCutoff(time: string): string {
  const total = timeToSeconds(time);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}
