/**
 * REGRESSION TESTS — Stabilization Phase
 * 
 * Locks current behavior for:
 * 1. Smart Import (single-line plain text)
 * 2. Structured Header Import (pipe-delimited)
 * 3. Source Normalization Mapping
 * 4. raw_line Integrity
 * 
 * NO new features. NO behavior changes.
 */
import { describe, it, expect } from 'vitest';
import { smartImportParse } from '@/lib/smartImport';
import { parseUpdate } from '@/lib/parser';
import { normalizeSource } from '@/lib/parser/sourceNormalizer';

// ============================================================================
// 1. Smart Import — Single Line
// ============================================================================
describe('Regression: Smart Import — Single Line', () => {
  it('parses "TransUnion emailed response 02/04/26: ..." into 1 event with correct fields', () => {
    const text = 'TransUnion emailed response 02/04/26: Hi TERRENCE CLEVELAND. We received your dispute...';
    const result = smartImportParse(text);

    expect(result.source).toBe('TransUnion');
    expect(result.event_kind).toBe('response');
    expect(result.event_date).toBe('2026-02-04');
    expect(result.date_is_unknown).toBe(false);
    expect(result.raw_line).toBe(text);
  });

  it('TransUnion event would route to TransUnion accordion (not Placement Errors)', () => {
    const result = smartImportParse('TransUnion emailed response 02/04/26: ...');
    // Source is PascalCase DB enum — matches accordion key exactly
    expect(result.source).toBe('TransUnion');
    expect(result.source).not.toBeNull();
  });
});

// ============================================================================
// 2. Smart Import — No Source → Placement Errors
// ============================================================================
describe('Regression: Smart Import — No Source', () => {
  it('input with no recognizable source returns source=null', () => {
    const text = 'Emailed response 02/04/26: ...';
    const result = smartImportParse(text);

    expect(result.source).toBeNull();
    expect(result.event_kind).toBe('response');
    expect(result.event_date).toBe('2026-02-04');
  });

  it('null source means event lands in Placement Errors bucket', () => {
    const result = smartImportParse('Some unknown entity did something');
    expect(result.source).toBeNull();
  });
});

// ============================================================================
// 3. Structured Header Import — Multi-Row, No Merging
// ============================================================================
describe('Regression: Structured Header Import', () => {
  it('creates 2 separate events from 2 rows under COMPLETED ACTIONS', () => {
    const input = `COMPLETED ACTIONS:
2026-02-05 | Experian | Dispute submitted | Sent certified mail
2026-02-05 | FTC | Identity theft report filed | Filed via identitytheft.gov`;

    const result = parseUpdate(input, 'test-client');

    expect(result.timeline_events.length).toBe(2);

    const sources = result.timeline_events.map(e => e.source).sort();
    expect(sources).toContain('experian');
    // Structured parser uses lowercase normalized sources (except FTC deterministic rule which uses 'FTC')
    // Actual behavior: FTC rule sets 'FTC' as NormalizedSource but normalizeSource returns 'ftc'
    // When source is 'FTC' in input, normalizeSource('FTC') returns 'ftc' (lowercase)
    expect(sources).toContain('ftc');

    // Each row is a separate event — no merging
    expect(result.timeline_events[0].raw_line).not.toBe(result.timeline_events[1].raw_line);
  });

  it('Experian event has event_kind=action from section header', () => {
    const input = `COMPLETED ACTIONS:
2026-02-05 | Experian | Dispute submitted | Details`;

    const result = parseUpdate(input, 'test-client');
    expect(result.timeline_events.length).toBe(1);
    expect(result.timeline_events[0].event_kind).toBe('action');
    expect(result.timeline_events[0].source).toBe('experian');
  });

  it('FTC event correctly mapped via deterministic FTC rule', () => {
    const input = `COMPLETED ACTIONS:
2026-02-05 | FTC | Identity theft report | Filed via identitytheft.gov`;

    const result = parseUpdate(input, 'test-client');
    expect(result.timeline_events.length).toBe(1);
    // FTC deterministic rule in rowParsers sets 'FTC' as NormalizedSource,
    // but when FTC is in the source column, normalizeSource runs first and returns 'ftc'
    // Current behavior: source column 'FTC' → normalizeSource → 'ftc', then FTC rule doesn't fire (sources.length > 0)
    expect(result.timeline_events[0].source).toBe('ftc');
    expect(result.timeline_events[0].event_kind).toBe('action');
  });
});

// ============================================================================
// 4. Source Normalization Mapping
// ============================================================================
describe('Regression: Source Mapping', () => {
  it('ftc → ftc (normalized)', () => {
    expect(normalizeSource('ftc')).toBe('ftc');
  });

  it('cfpb → cfpb (normalized)', () => {
    expect(normalizeSource('cfpb')).toBe('cfpb');
  });

  it('ag → ag (normalized)', () => {
    expect(normalizeSource('ag')).toBe('ag');
  });

  it('Attorney General → ag', () => {
    expect(normalizeSource('Attorney General')).toBe('ag');
  });

  it('unknown source does not mutate to a valid enum — returns null', () => {
    expect(normalizeSource('Unknown Entity')).toBeNull();
    expect(normalizeSource('Random Corp')).toBeNull();
    expect(normalizeSource('')).toBeNull();
    expect(normalizeSource('XYZZY')).toBeNull();
  });

  it('Smart Import source detection maps to PascalCase DB enums', () => {
    expect(smartImportParse('FTC report filed 01/01/26').source).toBe('FTC');
    expect(smartImportParse('CFPB complaint filed 01/01/26').source).toBe('CFPB');
    expect(smartImportParse('AG office contacted 01/01/26').source).toBe('AG');
  });
});

// ============================================================================
// 5. raw_line Integrity
// ============================================================================
describe('Regression: raw_line Integrity', () => {
  it('Smart Import preserves raw_line exactly as input', () => {
    const input = 'TransUnion emailed response 02/04/26: Hi TERRENCE CLEVELAND. We received your dispute regarding the items listed below.';
    const result = smartImportParse(input);
    expect(result.raw_line).toBe(input);
  });

  it('Structured parser preserves raw_line for each row verbatim', () => {
    const row1 = '2026-02-05 | Experian | Dispute submitted | Sent certified mail';
    const row2 = '2026-02-05 | Equifax | Freeze request | Submitted online';
    const input = `COMPLETED ACTIONS:\n${row1}\n${row2}`;

    const result = parseUpdate(input, 'test-client');
    expect(result.timeline_events.length).toBe(2);

    const rawLines = result.timeline_events.map(e => e.raw_line);
    expect(rawLines).toContain(row1);
    expect(rawLines).toContain(row2);
  });

  it('raw_line is never null for Smart Import', () => {
    const result = smartImportParse('anything at all');
    expect(result.raw_line).toBeTruthy();
    expect(typeof result.raw_line).toBe('string');
  });

  it('long raw_line is not truncated', () => {
    const longInput = 'TransUnion ' + 'A'.repeat(500) + ' response 02/04/26';
    const result = smartImportParse(longInput);
    expect(result.raw_line.length).toBe(longInput.length);
    expect(result.raw_line).toBe(longInput);
  });
});
