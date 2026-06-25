import type { EventSource, TimelineEvent } from '@/types/operator';
import { filterEvidenceForSource } from '@/lib/bureauResponseFacts';

export type LetterMode = 'initial' | 'follow_up';
export type DisputeFocus = 'auto' | 'tradeline' | 'inquiry';

const CRA_SOURCES: EventSource[] = ['Experian', 'TransUnion', 'Equifax'];

export function isCraSource(source: EventSource): boolean {
  return CRA_SOURCES.includes(source);
}

/** Suggest initial vs follow-up from committed timeline evidence for the selected source. */
export function suggestLetterMode(events: TimelineEvent[], source: EventSource): LetterMode {
  const forSource = filterEvidenceForSource(events, source);
  if (forSource.length === 0) return 'initial';

  const hasResponse = forSource.some((e) => e.event_kind === 'response');
  const hasOutcome = forSource.some((e) => e.event_kind === 'outcome');
  if (hasResponse || hasOutcome) return 'follow_up';

  const hasPriorDisputeAction = forSource.some(
    (e) =>
      e.event_kind === 'action' &&
      /dispute|correspondence|mail|letter|complaint|furnisher|bureau|cra/i.test(
        `${e.title} ${e.summary} ${e.raw_line ?? ''}`
      )
  );
  return hasPriorDisputeAction ? 'follow_up' : 'initial';
}

export function letterTypeLabel(mode: LetterMode, focus: DisputeFocus): string {
  if (focus === 'inquiry') {
    return mode === 'follow_up'
      ? 'Inquiry Dispute Follow-up — FCRA §605B'
      : 'Inquiry Dispute — FCRA §605B / Identity Theft';
  }
  return mode === 'follow_up' ? 'Bureau Dispute — Follow-up' : 'Bureau Dispute — Initial';
}
