/**
 * Tests for JSON Import Validator
 */
import { describe, it, expect } from 'vitest';
import { parseJsonImportArray, validateJsonImportBatch, mapValidatedToDb } from '@/lib/jsonImportValidator';

describe('parseJsonImportArray', () => {
  it('returns array for valid JSON array of objects', () => {
    const input = JSON.stringify([{ event_date: '2026-02-05', title: 'Test' }]);
    expect(parseJsonImportArray(input)).toHaveLength(1);
  });

  it('returns null for non-array JSON', () => {
    expect(parseJsonImportArray('{"key": "value"}')).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(parseJsonImportArray('[]')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseJsonImportArray('not json')).toBeNull();
  });

  it('returns null for array of primitives', () => {
    expect(parseJsonImportArray('[1, 2, 3]')).toBeNull();
  });
});

describe('validateJsonImportBatch', () => {
  function makeValidEvent(overrides: Partial<any> = {}) {
    return {
      event_date: '2026-02-05',
      date_is_unknown: false,
      category: 'Action',
      source: 'Experian',
      title: 'Dispute sent',
      summary: 'Sent dispute letter',
      raw_line: '2026-02-05 | Experian | Dispute sent',
      event_kind: 'action',
      ...overrides,
    };
  }

  it('validates a fully valid event', () => {
    const result = validateJsonImportBatch([makeValidEvent()]);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
    expect(result.rows[0].valid).toBe(true);
  });

  it('flags missing required fields', () => {
    const result = validateJsonImportBatch([{ event_date: null } as any]);
    expect(result.invalidCount).toBe(1);
    expect(result.rows[0].errors.length).toBeGreaterThan(0);
  });

  it('flags unsupported category', () => {
    const result = validateJsonImportBatch([makeValidEvent({ category: 'InvalidCat' })]);
    expect(result.rows[0].valid).toBe(false);
    expect(result.rows[0].errors.some(e => e.includes('Unsupported category'))).toBe(true);
  });

  it('flags unsupported event_kind', () => {
    const result = validateJsonImportBatch([makeValidEvent({ event_kind: 'invalid' })]);
    expect(result.rows[0].valid).toBe(false);
  });

  it('allows Note category and note event_kind', () => {
    const result = validateJsonImportBatch([makeValidEvent({ category: 'Note', event_kind: 'note' })]);
    expect(result.validCount).toBe(1);
  });

  it('warns on unknown source and maps to Other', () => {
    const result = validateJsonImportBatch([makeValidEvent({ source: 'UnknownCorp' })]);
    expect(result.rows[0].valid).toBe(true);
    expect(result.rows[0].warnings.length).toBe(1);
    expect(result.rows[0].validated!.source).toBe('Other');
  });

  it('allows null source', () => {
    const result = validateJsonImportBatch([makeValidEvent({ source: null })]);
    expect(result.rows[0].valid).toBe(true);
    expect(result.rows[0].validated!.source).toBeNull();
  });

  it('flags invalid date format', () => {
    const result = validateJsonImportBatch([makeValidEvent({ event_date: '02/05/2026' })]);
    expect(result.rows[0].valid).toBe(false);
    expect(result.rows[0].errors.some(e => e.includes('Invalid event_date'))).toBe(true);
  });

  it('validates mixed valid and invalid rows independently', () => {
    const result = validateJsonImportBatch([
      makeValidEvent(),
      makeValidEvent({ title: '' }),  // invalid
      makeValidEvent({ source: 'FTC' }),
    ]);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(1);
    expect(result.rows[1].valid).toBe(false);
  });

  it('preserves raw_line verbatim', () => {
    const rawLine = '2026-02-05 | FTC | Identity Theft Report | Filed via identitytheft.gov';
    const result = validateJsonImportBatch([makeValidEvent({ raw_line: rawLine })]);
    expect(result.rows[0].validated!.raw_line).toBe(rawLine);
  });

  it('defaults is_draft to false when not provided', () => {
    const result = validateJsonImportBatch([makeValidEvent()]);
    expect(result.rows[0].validated!.is_draft).toBe(false);
  });

  it('preserves note event_kind without remapping (regression: DB constraint now allows note)', () => {
    const result = validateJsonImportBatch([makeValidEvent({ category: 'Note', event_kind: 'note' })]);
    expect(result.validCount).toBe(1);
    expect(result.rows[0].validated!.event_kind).toBe('note');
    expect(result.rows[0].validated!.category).toBe('Note');
    expect(result.rows[0].validated!.is_draft).toBe(false);
  });
});

describe('mapValidatedToDb', () => {
  it('maps validated events with client_id', () => {
    const validated = {
      event_date: '2026-02-05',
      date_is_unknown: false,
      category: 'Action' as const,
      source: 'Experian' as const,
      title: 'Test',
      summary: 'Test summary',
      raw_line: 'raw',
      event_kind: 'action',
      details: null,
      related_accounts: null,
      is_draft: false,
    };
    const result = mapValidatedToDb([validated], 'client-123');
    expect(result).toHaveLength(1);
    expect(result[0].client_id).toBe('client-123');
    expect(result[0].raw_line).toBe('raw');
  });
});
