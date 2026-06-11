import { describe, it, expect } from 'vitest';
import {
  filterEvidenceForSource,
  summarizeEvidenceCounts,
  timelineToEvidenceFacts,
} from '@/lib/bureauResponseFacts';
import type { TimelineEvent } from '@/types/operator';

function ev(partial: Partial<TimelineEvent> & Pick<TimelineEvent, 'id' | 'client_id'>): TimelineEvent {
  return {
    category: 'Action',
    source: 'Experian',
    title: 't',
    summary: 's',
    details: null,
    related_accounts: null,
    event_date: null,
    created_at: '2025-01-01',
    ...partial,
  };
}

describe('bureauResponseFacts', () => {
  it('filters by source', () => {
    const rows = [
      ev({ id: '1', client_id: 'c', source: 'Experian' }),
      ev({ id: '2', client_id: 'c', source: 'Equifax' }),
    ];
    expect(filterEvidenceForSource(rows, 'Experian')).toHaveLength(1);
    expect(filterEvidenceForSource(rows, 'Experian')[0].id).toBe('1');
  });

  it('summarizes event_kind counts', () => {
    const rows = [
      ev({ id: '1', client_id: 'c', event_kind: 'action' }),
      ev({ id: '2', client_id: 'c', event_kind: 'response' }),
      ev({ id: '3', client_id: 'c', event_kind: 'response' }),
      ev({ id: '4', client_id: 'c', event_kind: 'outcome' }),
      ev({ id: '5', client_id: 'c', event_kind: 'note' }),
    ];
    const s = summarizeEvidenceCounts(rows);
    expect(s.total).toBe(5);
    expect(s.actions).toBe(1);
    expect(s.responses).toBe(2);
    expect(s.outcomes).toBe(1);
    expect(s.notes).toBe(1);
  });

  it('maps timeline rows to evidence facts', () => {
    const rows = [
      ev({
        id: '1',
        client_id: 'c',
        event_kind: 'action',
        raw_line: ' Sent dispute ',
        summary: 'sum',
        title: 'title',
      }),
    ];
    const facts = timelineToEvidenceFacts(rows);
    expect(facts[0].raw_line).toBe('Sent dispute');
    expect(facts[0].event_kind).toBe('action');
  });
});
