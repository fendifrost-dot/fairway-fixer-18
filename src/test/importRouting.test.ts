/**
 * REGRESSION TESTS — Import Routing Gate & Source Translation Boundary
 *
 * Locks the two real failure points:
 * 1. selectImportMode: prevents structured input from being misrouted to Smart Import
 * 2. mapTimelineEventToDb: prevents source casing mismatches at the DB boundary
 */
import { describe, it, expect } from 'vitest';
import { selectImportMode, mapTimelineEventToDb } from '@/lib/importRouting';
import { TimelineEventParsed } from '@/types/parser';

// ============================================================================
// 1. selectImportMode — Import Routing Gate
// ============================================================================
describe('Regression: selectImportMode', () => {
  it('single-line non-JSON → smart', () => {
    expect(selectImportMode('TransUnion emailed response 02/04/26')).toBe('smart');
  });

  it('single-line plain text with no source → smart', () => {
    expect(selectImportMode('Some random note about a client')).toBe('smart');
  });

  it('multi-line non-JSON → structured', () => {
    const input = `Line one about something
Line two about something else`;
    expect(selectImportMode(input)).toBe('structured');
  });

  it('structured header (COMPLETED ACTIONS) → structured', () => {
    const input = `COMPLETED ACTIONS:
2026-02-05 | Experian | Dispute | Sent`;
    expect(selectImportMode(input)).toBe('structured');
  });

  it('structured header (RESPONSES RECEIVED) → structured', () => {
    const input = `RESPONSES:
2026-02-10 | TransUnion | Verified | No docs`;
    expect(selectImportMode(input)).toBe('structured');
  });

  it('structured header with markdown prefix → structured', () => {
    const input = `### COMPLETED ACTIONS:
2026-02-05 | Experian | Dispute | Sent`;
    expect(selectImportMode(input)).toBe('structured');
  });

  it('JSON object → json', () => {
    expect(selectImportMode('{"key": "value"}')).toBe('json');
  });

  it('JSON array → json', () => {
    expect(selectImportMode('[{"event": "test"}]')).toBe('json');
  });

  it('JSON with leading whitespace → json', () => {
    expect(selectImportMode('  { "key": "value" }')).toBe('json');
  });

  it('multi-line with structured header → structured (not smart)', () => {
    // This is the exact regression case: structured input must NOT go to smart
    const input = `COMPLETED ACTIONS:
2026-02-05 | Experian | Dispute submitted | Sent certified mail
2026-02-05 | FTC | Identity theft report filed | Filed online`;
    expect(selectImportMode(input)).toBe('structured');
  });
});

// ============================================================================
// 2. mapTimelineEventToDb — Source Translation Boundary
// ============================================================================
describe('Regression: mapTimelineEventToDb source mapping', () => {
  function makeParsedEvent(source: string): TimelineEventParsed {
    return {
      event_kind: 'action',
      event_date: '2026-02-05',
      date_is_unknown: false,
      source: source as any,
      scope: 'single',
      action_type: 'Dispute',
      status_verb: null,
      counterparty: null,
      account_ref: null,
      description: 'Test event',
      raw_line: 'test raw line',
    };
  }

  it('ftc → FTC', () => {
    const result = mapTimelineEventToDb(makeParsedEvent('ftc'), 'client-1');
    expect(result.source).toBe('FTC');
  });

  it('cfpb → CFPB', () => {
    const result = mapTimelineEventToDb(makeParsedEvent('cfpb'), 'client-1');
    expect(result.source).toBe('CFPB');
  });

  it('ag → AG', () => {
    const result = mapTimelineEventToDb(makeParsedEvent('ag'), 'client-1');
    expect(result.source).toBe('AG');
  });

  it('experian → Experian', () => {
    const result = mapTimelineEventToDb(makeParsedEvent('experian'), 'client-1');
    expect(result.source).toBe('Experian');
  });

  it('transunion → TransUnion', () => {
    const result = mapTimelineEventToDb(makeParsedEvent('transunion'), 'client-1');
    expect(result.source).toBe('TransUnion');
  });

  it('equifax → Equifax', () => {
    const result = mapTimelineEventToDb(makeParsedEvent('equifax'), 'client-1');
    expect(result.source).toBe('Equifax');
  });

  it('unknown normalized source falls back to Other', () => {
    const result = mapTimelineEventToDb(makeParsedEvent('unknown_corp'), 'client-1');
    expect(result.source).toBe('Other');
  });

  it('empty string source falls back to Other', () => {
    const result = mapTimelineEventToDb(makeParsedEvent(''), 'client-1');
    expect(result.source).toBe('Other');
  });

  it('preserves raw_line verbatim through mapping', () => {
    const rawLine = '2026-02-05 | FTC | Identity Theft Report | Filed via identitytheft.gov';
    const event = makeParsedEvent('ftc');
    event.raw_line = rawLine;
    const result = mapTimelineEventToDb(event, 'client-1');
    expect(result.raw_line).toBe(rawLine);
  });

  it('maps event_kind to correct category', () => {
    const action = makeParsedEvent('experian');
    action.event_kind = 'action';
    expect(mapTimelineEventToDb(action, 'c').category).toBe('Action');

    const response = makeParsedEvent('experian');
    response.event_kind = 'response';
    expect(mapTimelineEventToDb(response, 'c').category).toBe('Response');

    const outcome = makeParsedEvent('experian');
    outcome.event_kind = 'outcome';
    expect(mapTimelineEventToDb(outcome, 'c').category).toBe('Outcome');
  });

  it('is_draft is always false', () => {
    const result = mapTimelineEventToDb(makeParsedEvent('experian'), 'client-1');
    expect(result.is_draft).toBe(false);
  });
});
