import type { TimelineEvent, EventSource } from '@/types/operator';

/** Serializable row sent to the edge function (no DB-only fields required). */
export interface BureauEvidenceFact {
  event_kind: string | null;
  category: string;
  event_date: string | null;
  date_is_unknown?: boolean;
  summary: string;
  title: string;
  raw_line: string;
}

export interface BureauEvidenceSummary {
  total: number;
  actions: number;
  responses: number;
  outcomes: number;
  notes: number;
}

export function filterEvidenceForSource(
  events: TimelineEvent[],
  source: EventSource
): TimelineEvent[] {
  return events.filter((e) => e.source === source);
}

export function timelineToEvidenceFacts(events: TimelineEvent[]): BureauEvidenceFact[] {
  return events.map((e) => ({
    event_kind: e.event_kind ?? null,
    category: e.category,
    event_date: e.event_date ?? null,
    date_is_unknown: e.date_is_unknown,
    summary: e.summary ?? '',
    title: e.title ?? '',
    raw_line: (e.raw_line ?? '').trim(),
  }));
}

export function summarizeEvidenceCounts(events: TimelineEvent[]): BureauEvidenceSummary {
  let actions = 0;
  let responses = 0;
  let outcomes = 0;
  let notes = 0;
  for (const e of events) {
    const k = (e.event_kind || '').toLowerCase();
    if (k === 'action') actions++;
    else if (k === 'response') responses++;
    else if (k === 'outcome') outcomes++;
    else if (k === 'note') notes++;
  }
  return {
    total: events.length,
    actions,
    responses,
    outcomes,
    notes,
  };
}
