import { describe, expect, it } from 'vitest';
import { colomboClock, formatCutoff, isOrderingOpen, timeToSeconds } from '../time';

// Colombo is UTC+05:30 all year (no DST).
const atColombo = (iso: string) => new Date(`${iso}+05:30`);

describe('colomboClock', () => {
  it('converts UTC to Colombo date and time', () => {
    expect(colomboClock(new Date('2026-11-08T12:29:59Z'))).toEqual({
      date: '2026-11-08',
      time: '17:59:59',
    });
  });
  it('rolls the date over at Colombo midnight, not UTC midnight', () => {
    expect(colomboClock(new Date('2026-11-08T18:30:00Z')).date).toBe('2026-11-09');
    expect(colomboClock(new Date('2026-11-08T18:29:59Z')).date).toBe('2026-11-08');
  });
});

describe('isOrderingOpen', () => {
  const settings = { cutoff_time: '18:00:00', ordering_enabled: true };
  it('is open before the cutoff', () => {
    expect(isOrderingOpen(settings, atColombo('2026-11-08T17:59:59'))).toBe(true);
  });
  it('is closed exactly at the cutoff', () => {
    expect(isOrderingOpen(settings, atColombo('2026-11-08T18:00:00'))).toBe(false);
  });
  it('is closed after the cutoff', () => {
    expect(isOrderingOpen(settings, atColombo('2026-11-08T21:00:00'))).toBe(false);
  });
  it('is open again after midnight', () => {
    expect(isOrderingOpen(settings, atColombo('2026-11-09T00:00:01'))).toBe(true);
  });
  it('is closed when ordering is disabled', () => {
    expect(
      isOrderingOpen({ ...settings, ordering_enabled: false }, atColombo('2026-11-08T09:00:00')),
    ).toBe(false);
  });
  it('accepts HH:MM cutoffs', () => {
    expect(
      isOrderingOpen(
        { cutoff_time: '18:30', ordering_enabled: true },
        atColombo('2026-11-08T18:15:00'),
      ),
    ).toBe(true);
  });
});

describe('time helpers', () => {
  it('parses times', () => {
    expect(timeToSeconds('18:00')).toBe(64800);
    expect(timeToSeconds('00:00:01')).toBe(1);
    expect(() => timeToSeconds('25:00')).toThrow();
  });
  it('formats cutoffs', () => {
    expect(formatCutoff('18:00:00')).toBe('6:00 PM');
    expect(formatCutoff('12:30')).toBe('12:30 PM');
    expect(formatCutoff('00:15')).toBe('12:15 AM');
    expect(formatCutoff('09:05')).toBe('9:05 AM');
  });
});
