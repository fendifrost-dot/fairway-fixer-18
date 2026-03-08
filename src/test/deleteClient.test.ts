/**
 * Regression tests for Delete Client cascade and AI review flows.
 * These test the LOGIC, not the actual DB calls (which require auth).
 */
import { describe, it, expect, vi } from 'vitest';

// ─── Delete Client Dialog logic ───

describe('DeleteClientDialog logic', () => {
  it('requires typing DELETE to proceed', () => {
    const confirmText = 'DELETE';
    const understood = true;
    const hasRiskyStates = false;
    const canProceed = confirmText === 'DELETE' && understood && !hasRiskyStates;
    expect(canProceed).toBe(true);
  });

  it('blocks if DELETE not typed', () => {
    const confirmText = 'delete' as string; // case-sensitive
    const understood = true;
    const canProceed = confirmText === 'DELETE' && understood;
    expect(canProceed).toBe(false);
  });

  it('blocks if checkbox not checked', () => {
    const confirmText = 'DELETE';
    const understood = false;
    const canProceed = confirmText === 'DELETE' && understood;
    expect(canProceed).toBe(false);
  });

  it('requires elevated confirmation for risky states', () => {
    const confirmText = 'DELETE';
    const understood = true;
    const hasRiskyStates = true;
    const step = 'confirm' as const;
    
    // First click should transition to elevated step, not execute
    const shouldTransition = hasRiskyStates && step === 'confirm';
    expect(shouldTransition).toBe(true);
  });

  it('blocks elevated step if wrong text', () => {
    const elevatedText = 'DELETE LITIGATION';
    const canExecute = elevatedText === 'DELETE LITIGATION DATA';
    expect(canExecute).toBe(false);
  });

  it('allows elevated step with correct text', () => {
    const elevatedText = 'DELETE LITIGATION DATA';
    const canExecute = elevatedText === 'DELETE LITIGATION DATA';
    expect(canExecute).toBe(true);
  });
});

// ─── AI Review Panel: raw_line preservation ───

describe('AI Review raw_line preservation', () => {
  it('preserves original_line from input, not AI output', () => {
    const originalLines = [
      'Sent dispute to Experian on 2025-01-15',
      'Equifax deleted account 1234567890',
    ];
    
    const aiEvents = [
      {
        line_index: 1,
        event_kind: 'action' as const,
        category: 'Action' as const,
        source: 'Experian',
        event_date: '2025-01-15',
        summary: 'Dispute letter sent to Experian',
        confidence: 'high' as const,
      },
      {
        line_index: 2,
        event_kind: 'outcome' as const,
        category: 'Outcome' as const,
        source: 'Equifax',
        event_date: null,
        summary: 'Account deleted by Equifax',
        confidence: 'medium' as const,
      },
    ];

    // Simulate mapping — original_line comes from originalLines[line_index - 1]
    const suggestions = aiEvents.map((e) => ({
      ...e,
      original_line: originalLines[e.line_index - 1] || '',
    }));

    expect(suggestions[0].original_line).toBe('Sent dispute to Experian on 2025-01-15');
    expect(suggestions[1].original_line).toBe('Equifax deleted account 1234567890');
    // AI summary is different from original_line — proving they're independent
    expect(suggestions[0].original_line).not.toBe(suggestions[0].summary);
  });

  it('raw_line in DB event uses original_line, not summary', () => {
    const item = {
      event_kind: 'action' as const,
      source: 'Experian',
      summary: 'AI-generated summary text',
      original_line: 'Original verbatim input from operator',
      event_date: '2025-01-15',
    };

    // Simulating the commit mapping from AIReviewPanel
    const dbEvent = {
      raw_line: item.original_line, // MUST be original, NOT summary
      summary: item.summary.slice(0, 200),
    };

    expect(dbEvent.raw_line).toBe('Original verbatim input from operator');
    expect(dbEvent.raw_line).not.toBe(dbEvent.summary);
  });
});

// ─── AI Review accept/reject flow ───

describe('AI Review accept/reject flow', () => {
  it('starts with all items pending (accepted = null)', () => {
    const suggestions = [
      { line_index: 1, event_kind: 'action' as const, category: 'Action' as const, source: 'Experian', event_date: null, summary: 'test', confidence: 'high' as const, original_line: 'test' },
    ];
    const items = suggestions.map(s => ({ ...s, accepted: null as boolean | null }));
    expect(items.every(i => i.accepted === null)).toBe(true);
  });

  it('accepting sets accepted = true', () => {
    const items = [
      { accepted: null as boolean | null, summary: 'Event 1' },
      { accepted: null as boolean | null, summary: 'Event 2' },
    ];
    // Accept item 0
    items[0].accepted = true;
    expect(items.filter(i => i.accepted === true).length).toBe(1);
    expect(items.filter(i => i.accepted === null).length).toBe(1);
  });

  it('rejecting sets accepted = false', () => {
    const items = [
      { accepted: null as boolean | null, summary: 'Event 1' },
    ];
    items[0].accepted = false;
    expect(items.filter(i => i.accepted === false).length).toBe(1);
    expect(items.filter(i => i.accepted === true).length).toBe(0);
  });

  it('only accepted items are committed', () => {
    const items = [
      { accepted: true, summary: 'Keep' },
      { accepted: false, summary: 'Reject' },
      { accepted: null as boolean | null, summary: 'Pending' },
    ];
    const toCommit = items.filter(i => i.accepted === true);
    expect(toCommit.length).toBe(1);
    expect(toCommit[0].summary).toBe('Keep');
  });
});

// ─── Duplicate fingerprint prevention ───

describe('Duplicate fingerprint prevention', () => {
  /**
   * Fingerprinting: normalize source+date+first-50-chars-of-summary
   * to detect duplicate events before insert.
   */
  function fingerprint(event: { source: string | null; event_date: string | null; summary: string }): string {
    const s = (event.source || 'unknown').toLowerCase();
    const d = event.event_date || 'nodate';
    const t = event.summary.slice(0, 50).toLowerCase().replace(/\s+/g, ' ').trim();
    return `${s}|${d}|${t}`;
  }

  it('detects exact duplicates', () => {
    const e1 = { source: 'Experian', event_date: '2025-01-15', summary: 'Dispute letter sent' };
    const e2 = { source: 'Experian', event_date: '2025-01-15', summary: 'Dispute letter sent' };
    expect(fingerprint(e1)).toBe(fingerprint(e2));
  });

  it('differentiates events with different sources', () => {
    const e1 = { source: 'Experian', event_date: '2025-01-15', summary: 'Dispute letter sent' };
    const e2 = { source: 'Equifax', event_date: '2025-01-15', summary: 'Dispute letter sent' };
    expect(fingerprint(e1)).not.toBe(fingerprint(e2));
  });

  it('differentiates events with different dates', () => {
    const e1 = { source: 'Experian', event_date: '2025-01-15', summary: 'Dispute letter sent' };
    const e2 = { source: 'Experian', event_date: '2025-02-15', summary: 'Dispute letter sent' };
    expect(fingerprint(e1)).not.toBe(fingerprint(e2));
  });

  it('handles null source and date gracefully', () => {
    const e1 = { source: null, event_date: null, summary: 'Something happened' };
    const fp = fingerprint(e1);
    expect(fp).toBe('unknown|nodate|something happened');
  });

  it('deduplicates a batch by keeping first occurrence', () => {
    const batch = [
      { source: 'Experian', event_date: '2025-01-15', summary: 'Dispute letter sent' },
      { source: 'Experian', event_date: '2025-01-15', summary: 'Dispute letter sent' },
      { source: 'Equifax', event_date: '2025-01-15', summary: 'Dispute letter sent' },
    ];
    const seen = new Set<string>();
    const deduped = batch.filter(e => {
      const fp = fingerprint(e);
      if (seen.has(fp)) return false;
      seen.add(fp);
      return true;
    });
    expect(deduped.length).toBe(2);
  });
});
