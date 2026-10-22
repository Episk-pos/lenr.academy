import { describe, it, expect } from 'vitest';
import { formatTimeAgo } from './relativeTime';

const NOW = new Date('2026-10-22T12:00:00Z').getTime();
const ago = (ms: number) => NOW - ms;
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatTimeAgo', () => {
  it('uses the "now" bucket for anything under a minute', () => {
    const expected = new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(0, 'second');
    expect(formatTimeAgo(ago(5 * SEC), 'en', NOW)).toBe(expected);
    expect(formatTimeAgo(ago(59 * SEC), 'en', NOW)).toBe(expected);
    // Clock skew (future timestamp) is clamped rather than producing "in N seconds"
    expect(formatTimeAgo(NOW + 10 * SEC, 'en', NOW)).toBe(expected);
  });

  it('formats minutes, hours and days in English', () => {
    expect(formatTimeAgo(ago(5 * MIN), 'en', NOW)).toBe('5 minutes ago');
    expect(formatTimeAgo(ago(1 * HOUR), 'en', NOW)).toBe('1 hour ago');
    expect(formatTimeAgo(ago(3 * HOUR), 'en', NOW)).toBe('3 hours ago');
    expect(formatTimeAgo(ago(1 * DAY), 'en', NOW)).toBe('yesterday');
    expect(formatTimeAgo(ago(3 * DAY), 'en', NOW)).toBe('3 days ago');
  });

  it('localizes output for other languages', () => {
    for (const lng of ['de', 'hi', 'ru', 'ja']) {
      const rtf = new Intl.RelativeTimeFormat(lng, { numeric: 'auto' });
      expect(formatTimeAgo(ago(5 * MIN), lng, NOW)).toBe(rtf.format(-5, 'minute'));
      expect(formatTimeAgo(ago(2 * HOUR), lng, NOW)).toBe(rtf.format(-2, 'hour'));
      expect(formatTimeAgo(ago(30 * SEC), lng, NOW)).toBe(rtf.format(0, 'second'));
    }
    expect(formatTimeAgo(ago(5 * MIN), 'de', NOW)).toBe('vor 5 Minuten');
    expect(formatTimeAgo(ago(5 * MIN), 'en', NOW)).not.toBe(formatTimeAgo(ago(5 * MIN), 'hi', NOW));
  });

  it('falls back to a localized calendar date after a week', () => {
    const ts = ago(10 * DAY);
    expect(formatTimeAgo(ts, 'de', NOW)).toBe(new Date(ts).toLocaleDateString('de'));
    expect(formatTimeAgo(ts, 'hi', NOW)).toBe(new Date(ts).toLocaleDateString('hi'));
  });

  it('tolerates an empty or invalid locale', () => {
    expect(formatTimeAgo(ago(5 * MIN), '', NOW)).toBe('5 minutes ago');
    expect(() => formatTimeAgo(ago(5 * MIN), 'not a locale!!', NOW)).not.toThrow();
  });
});
