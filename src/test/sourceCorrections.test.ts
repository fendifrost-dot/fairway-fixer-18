/**
 * Regression tests for source correction audit trail
 * Ensures lowercase normalization covers ALL EventSource values
 * and constraint alignment with timeline_events.source enum.
 */
import { describe, it, expect } from 'vitest';
import { ALL_SOURCES, EventSource } from '@/types/operator';

// The exact set the DB constraint allows (lowercase)
const DB_ALLOWED_FROM_SOURCES = new Set([
  'unassigned', 'experian', 'transunion', 'equifax',
  'innovis', 'lexisnexis', 'sagestream', 'corelogic',
  'chexsystems', 'ews', 'nctue',
  'ftc', 'cfpb', 'bbb', 'ag', 'other',
]);

const DB_ALLOWED_TO_SOURCES = new Set([
  'experian', 'transunion', 'equifax',
  'innovis', 'lexisnexis', 'sagestream', 'corelogic',
  'chexsystems', 'ews', 'nctue',
  'ftc', 'cfpb', 'bbb', 'ag', 'other',
]);

function toLowerSourceKey(source: EventSource): string {
  return source.toLowerCase();
}

describe('source_corrections constraint alignment', () => {
  it('every EventSource lowercased is in DB_ALLOWED_TO_SOURCES', () => {
    for (const source of ALL_SOURCES) {
      const lower = toLowerSourceKey(source);
      expect(DB_ALLOWED_TO_SOURCES.has(lower), `Missing to_source: "${lower}" (from "${source}")`).toBe(true);
    }
  });

  it('every EventSource lowercased is in DB_ALLOWED_FROM_SOURCES', () => {
    for (const source of ALL_SOURCES) {
      const lower = toLowerSourceKey(source);
      expect(DB_ALLOWED_FROM_SOURCES.has(lower), `Missing from_source: "${lower}" (from "${source}")`).toBe(true);
    }
  });

  it('"unassigned" is allowed as from_source but not as to_source', () => {
    expect(DB_ALLOWED_FROM_SOURCES.has('unassigned')).toBe(true);
    expect(DB_ALLOWED_TO_SOURCES.has('unassigned')).toBe(false);
  });

  it('simulates placement error → TransUnion correction without constraint violation', () => {
    const fromSource: string | null = null;
    const toSource: EventSource = 'TransUnion';

    // Normalize exactly as useSourceCorrections does
    const fromSourceLower = fromSource && fromSource !== 'Unassigned'
      ? fromSource.toLowerCase()
      : 'unassigned';
    const toSourceLower = toSource.toLowerCase();

    expect(DB_ALLOWED_FROM_SOURCES.has(fromSourceLower)).toBe(true);
    expect(DB_ALLOWED_TO_SOURCES.has(toSourceLower)).toBe(true);
    expect(fromSourceLower).not.toBe(toSourceLower); // source_changed constraint
  });

  it('simulates Other → Experian correction without constraint violation', () => {
    const fromSource: EventSource = 'Other';
    const toSource: EventSource = 'Experian';

    const fromSourceLower = fromSource.toLowerCase();
    const toSourceLower = toSource.toLowerCase();

    expect(DB_ALLOWED_FROM_SOURCES.has(fromSourceLower)).toBe(true);
    expect(DB_ALLOWED_TO_SOURCES.has(toSourceLower)).toBe(true);
    expect(fromSourceLower).not.toBe(toSourceLower);
  });
});
