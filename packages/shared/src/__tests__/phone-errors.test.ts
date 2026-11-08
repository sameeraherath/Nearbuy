import { describe, expect, it } from 'vitest';
import { formatSriLankanMobile, normalizeSriLankanMobile } from '../phone';
import { serverErrorMessage, wrongCodeMessage } from '../errors';
import { phoneSchema } from '../schemas';

describe('normalizeSriLankanMobile', () => {
  it.each([
    ['0771234567', '+94771234567'],
    ['771234567', '+94771234567'],
    ['94771234567', '+94771234567'],
    ['+94 77 123 4567', '+94771234567'],
    ['077-123-4567', '+94771234567'],
    ['0094771234567', '+94771234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeSriLankanMobile(input)).toBe(expected);
  });
  it.each(['0112345678', '+14155550123', '07712345', '077123456789', 'abc', ''])(
    'rejects %s',
    (input) => {
      expect(normalizeSriLankanMobile(input)).toBeNull();
    },
  );
  it('formats for display', () => {
    expect(formatSriLankanMobile('+94771234567')).toBe('+94 77 123 4567');
  });
  it('works through the zod schema', () => {
    expect(phoneSchema.parse('0712345678')).toBe('+94712345678');
    expect(phoneSchema.safeParse('12345').success).toBe(false);
  });
});

describe('server errors', () => {
  it('maps codes to friendly text', () => {
    expect(serverErrorMessage('NB_ORDERING_CLOSED')).toBe('Orders are closed for today');
    expect(serverErrorMessage('NB_MIN_ORDER:300')).toBe('Minimum order is Rs 300');
    expect(serverErrorMessage('random failure')).toBe('Something went wrong. Please try again.');
  });
  it('builds wrong-code messages', () => {
    expect(wrongCodeMessage(2)).toBe('Wrong code, 2 tries left');
    expect(wrongCodeMessage(1)).toBe('Wrong code, 1 try left');
    expect(wrongCodeMessage(0)).toBe('Call the student or contact admin');
  });
});
