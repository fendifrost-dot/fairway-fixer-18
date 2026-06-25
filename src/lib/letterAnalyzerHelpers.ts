import type { EventSource, TimelineEvent } from '@/types/operator';
import { filterEvidenceForSource } from '@/lib/bureauResponseFacts';

export type LetterMode = 'initial' | 'follow_up';
export type DisputeFocus = 'auto' | 'tradeline' | 'inquiry';

export interface StructuredHistoryCounts {
  dispute_rounds: number;
  dispute_letters: number;
  bureau_responses: number;
}

const CRA_SOURCES: EventSource[] = ['Experian', 'TransUnion', 'Equifax'];

export function isCraSource(source: EventSource): boolean {
  return CRA_SOURCES.includes(source);
}

function hasStructuredHistory(counts?: StructuredHistoryCounts): boolean {
  if (!counts) return false;
  return counts.dispute_rounds > 0 || counts.dispute_letters > 0 || counts.bureau_responses > 0;
}

/** Suggest initial vs follow-up from timeline + structured history tables. */
export function suggestLetterMode(
  events: TimelineEvent[],
  source: EventSource,
  structuredHistory?: StructuredHistoryCounts,
): LetterMode {
  if (hasStructuredHistory(structuredHistory)) return 'follow_up';

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

export interface AnalyzerMetaDisplay {
  evidence_same_source_count?: number;
  evidence_event_count?: number;
  evidence_scope?: string;
  prior_round_count?: number;
  prior_round_exists?: boolean;
  prior_letters_count?: number;
  bureau_responses_count?: number;
  has_reinsertion_signal?: boolean;
  has_verified_without_docs?: boolean;
  ftc_report_on_file?: boolean;
  tradeline_count?: number;
  violation_count?: number;
  letter_mode?: LetterMode;
  letter_mode_requested?: LetterMode;
  letter_mode_overridden?: boolean;
  scheduled_task_count?: number;
  history_digest_loaded?: boolean;
}

export function formatAnalyzerContextSummary(meta: AnalyzerMetaDisplay | null): string | null {
  if (!meta?.history_digest_loaded) return null;
  const parts: string[] = [];
  if (meta.prior_round_count != null && meta.prior_round_count > 0) {
    parts.push(`${meta.prior_round_count} dispute round(s)`);
  }
  if (meta.prior_letters_count != null && meta.prior_letters_count > 0) {
    parts.push(`${meta.prior_letters_count} prior letter(s)`);
  }
  if (meta.bureau_responses_count != null && meta.bureau_responses_count > 0) {
    parts.push(`${meta.bureau_responses_count} bureau response(s)`);
  }
  if (meta.ftc_report_on_file) parts.push('FTC ID theft report on file');
  if (meta.has_reinsertion_signal) parts.push('reinsertion signal');
  if (meta.tradeline_count != null) parts.push(`${meta.tradeline_count} tradeline(s)`);
  if (meta.violation_count != null && meta.violation_count > 0) {
    parts.push(`${meta.violation_count} violation(s)`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No structured history on file yet — seed via Lovable SQL or import timeline';
}
