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

  const mappedSource = sourceMap[event.source] || 'Other';

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
  };
}
