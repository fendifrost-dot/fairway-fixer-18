import { describe, it, expect } from 'vitest';
import { formatLastActive } from './useClientActivitySummary';

const now = new Date('2026-05-07T12:00:00Z');

describe('formatLastActive', () => {
  it('returns null for null input', () => {
    expect(formatLastActive(null, now)).toBeNull();
  });
  it('today', () => {
    expect(formatLastActive('2026-05-07T08:00:00Z', now)).toBe('today');
  });
  it('yesterday', () => {
    expect(formatLastActive('2026-05-06T08:00:00Z', now)).toBe('yesterday');
  });
  it('days', () => {
    expect(formatLastActive('2026-05-04T12:00:00Z', now)).toBe('3 days ago');
  });
  it('weeks', () => {
    expect(formatLastActive('2026-04-23T12:00:00Z', now)).toBe('2 weeks ago');
  });
  it('months', () => {
    expect(formatLastActive('2026-03-01T12:00:00Z', now)).toBe('2 months ago');
  });
  it('absolute for >3 months', () => {
    expect(formatLastActive('2025-11-01T12:00:00Z', now)).toBe('Nov 2025');
  });
});