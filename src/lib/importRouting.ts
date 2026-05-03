/**
 * Import Routing — Pure functions extracted for testability.
 * 
 * selectImportMode: decides which import path to use.
 * mapTimelineEventToDb: translates parsed events to DB format.
 * 
 * NO behavior changes. Exact same logic as ChatGPTImport.tsx inline.
 */

import { isJsonInput } from '@/lib/smartImport';
import { TimelineEventParsed } from '@/types/parser';
import { EventSource, EventCategory, RelatedAccount } from '@/types/operator';

export type ImportMode = 'json' | 'smart' | 'structured';

/**
 * Structured header detection — same regex as ChatGPTImport.tsx
 */
function isStructuredHeaderInput(text: string): boolean {
  const t = text.trim();
  return /^(?:#{1,6}\s*)?(COMPLETED ACTIONS|COMPLETED RESPONSES|COMPLETED OUTCOMES|OUTCOMES|ACTIONS|RESPONSES)\b[:\s]/i.test(t);
}

/**
 * Single-line detection — same logic as ChatGPTImport.tsx
 */
function isSingleLine(text: string): boolean {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  return lines.length === 1;
}

/**
 * Decide import mode for given input text.
 * 
 * Routing gate:
 * 1. JSON → 'json'
 * 2. Structured headers OR multi-line → 'structured'
 * 3. Single-line non-JSON → 'smart'
 */
export function selectImportMode(input: string): ImportMode {
  const trimmed = input.trim();
  if (!trimmed) return 'smart'; // degenerate case

  if (isJsonInput(trimmed)) return 'json';
  if (isStructuredHeaderInput(trimmed) || !isSingleLine(trimmed)) return 'structured';
  return 'smart';
}

// DB event shape
export type DbTimelineEvent = {
  client_id: string;
  event_date: string | null;
  date_is_unknown: boolean;
  category: EventCategory;
  source: EventSource | null;
  title: string;
  summary: string;
  details: string | null;
  related_accounts: RelatedAccount[] | null;
  raw_line: string;
  event_kind: string;
  is_draft: boolean;
  round_id?: string | null;
  /** Internal: parser-detected round number, resolved to round_id at import time. */
  round_number?: number | null;
  furnisher_id?: string | null;
  /** Internal: parser-detected furnisher name, resolved to furnisher_id at import time. */
  furnisher_name?: string | null;
  /** Internal: parser-detected furnisher account last 4, used for ensureFurnisher dedupe. */
  furnisher_account_last4?: string | null;
  /** B5: Optional tradeline this event is anchored to. */
  tradeline_id?: string | null;
  /** Internal: parser-detected [Tradeline: "..."] anchor name; resolved at import time. */
  tradeline_anchor?: string | null;
};

/**
 * Map a parsed timeline event to DB format.
 * Source translation boundary: lowercase normalized → PascalCase DB enum.
 * Unknown sources → 'Other'.
 */
export function mapTimelineEventToDb(event: TimelineEventParsed, clientId: string): DbTimelineEvent {
  const categoryMap: Record<string, EventCategory> = {
    action: 'Action',
    response: 'Response',
    outcome: 'Outcome',
  };

  const sourceMap: Record<string, EventSource> = {
    experian: 'Experian',
    transunion: 'TransUnion',
    equifax: 'Equifax',
    innovis: 'Innovis',
    lexisnexis: 'LexisNexis',
    sagestream: 'Sagestream',
    corelogic: 'CoreLogic',
    ftc: 'FTC',
    cfpb: 'CFPB',
    bbb: 'BBB',
    ag: 'AG',
  };

  // Furnisher events carry source=null; bureau events keep their mapped source.
  // Unknown sources fall back to 'Other' so they're still visible.
  const mappedSource: EventSource | null = event.source
    ? (sourceMap[event.source] || 'Other')
    : null;

  return {
    client_id: clientId,
    event_date: event.event_date || null,
    date_is_unknown: !event.event_date || event.date_is_unknown,
    category: categoryMap[event.event_kind] || 'Action',
    source: mappedSource,
    title: event.action_type || event.status_verb || event.event_kind,
    summary: event.description,
    details: event.account_ref || null,
    related_accounts: event.account_ref ? [{ name: event.account_ref }] : null,
    raw_line: event.raw_line,
    event_kind: event.event_kind,
    is_draft: false,
    round_number: event.round_number ?? null,
    furnisher_name: event.furnisher_name ?? null,
    furnisher_account_last4: event.furnisher_account_last4 ?? null,
    tradeline_anchor: event.tradeline_anchor ?? null,
  };
}
