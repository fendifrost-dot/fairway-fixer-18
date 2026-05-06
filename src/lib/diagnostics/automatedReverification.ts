/**
 * C3 — Automated reverification detector.
 *
 * Flags Response events from a bureau marking an item "Updated" / "Verified"
 * with a generic, undocumented body — the §1681i(a)(7) Cushman pattern.
 *
 * Persists into diagnostic_signals (signal_type='automated_reverification'),
 * deduped via the unique (client_id, signal_type, subject_ids) constraint.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  AutomatedReverificationSubjectIds,
  AutomatedReverificationEvidence,
} from '@/types/operator';

const tbl = (name: string) => (supabase as any).from(name);

const STATUS_VERBS = [
  'updated',
  'verified',
  'verified as accurate',
  'verified as belongs to you',
  'no change',
  'confirmed',
];

const INDICATOR_PHRASES = [
  'method of verification',
  'based on',
  'confirmed by furnisher',
  'documentation',
  'records show',
  'application on file',
  'signed agreement',
  'physical evidence',
  'reviewed',
  'investigated',
];

const MAX_SHORT_LEN = 80;
const FAST_RESPONSE_DAYS = 35;

function findStatusVerb(haystack: string): string | null {
  const h = haystack.toLowerCase();
  // longer phrases first
  const sorted = [...STATUS_VERBS].sort((a, b) => b.length - a.length);
  for (const v of sorted) {
    if (h.includes(v)) return v;
  }
  return null;
}

function missingIndicators(text: string): string[] {
  const t = text.toLowerCase();
  return INDICATOR_PHRASES.filter(p => !t.includes(p));
}

function daysBetweenISO(later: string, earlier: string): number {
  const a = new Date(later).getTime();
  const b = new Date(earlier).getTime();
  return Math.max(0, Math.round((a - b) / 86400000));
}

interface EventRow {
  id: string;
  client_id: string;
  category: string;
  source: string | null;
  tradeline_id: string | null;
  event_kind: string | null;
  event_date: string | null;
  title: string;
  summary: string;
  details: string | null;
}

export interface AutomatedReverificationMatch {
  event: EventRow;
  evidence: AutomatedReverificationEvidence;
  subject_ids: AutomatedReverificationSubjectIds;
}

export function findAutomatedReverificationMatches(events: EventRow[]): AutomatedReverificationMatch[] {
  const out: AutomatedReverificationMatch[] = [];

  // Index most-recent action event per bureau, ordered by date asc.
  const actionsByBureau = new Map<string, EventRow[]>();
  for (const e of events) {
    if (e.event_kind !== 'action') continue;
    if (!e.source) continue;
    const arr = actionsByBureau.get(e.source) || [];
    arr.push(e);
    actionsByBureau.set(e.source, arr);
  }
  for (const arr of actionsByBureau.values()) {
    arr.sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''));
  }

  for (const ev of events) {
    if (ev.category !== 'Response') continue;
    if (!ev.source) continue;
    const haystack = `${ev.title || ''} ${ev.summary || ''} ${ev.details || ''}`;
    const verb = findStatusVerb(haystack);
    if (!verb) continue;

    const body = `${ev.summary || ''} ${ev.details || ''}`.trim();
    const summary_length = body.length;
    const missing = missingIndicators(body);
    const allMissing = missing.length === INDICATOR_PHRASES.length;
    const isShort = summary_length <= MAX_SHORT_LEN;

    // HIGH-likelihood criteria for firing the signal.
    if (!isShort || !allMissing) continue;

    // Find the most recent prior action on the same bureau.
    let related_action_event_id: string | null = null;
    let days_since_dispute: number | null = null;
    if (ev.event_date) {
      const arr = actionsByBureau.get(ev.source) || [];
      let bestDate: string | null = null;
      for (const a of arr) {
        if (!a.event_date) continue;
        if (a.event_date <= ev.event_date) {
          if (!bestDate || a.event_date > bestDate) {
            bestDate = a.event_date;
            related_action_event_id = a.id;
          }
        }
      }
      if (bestDate) {
        days_since_dispute = daysBetweenISO(ev.event_date, bestDate);
      }
    }

    // If we DO know the elapsed days, require it to be within the window.
    // If we don't know (no prior action found), still allow signal — the
    // generic short response + lack of indicators is itself sufficient.
    if (days_since_dispute != null && days_since_dispute > FAST_RESPONSE_DAYS) continue;

    const evidence: AutomatedReverificationEvidence = {
      summary_length,
      days_since_dispute,
      missing_indicators: missing,
      status_verb_matched: verb,
      response_date: ev.event_date,
      related_action_event_id,
      event_title: ev.title,
    };
    const subject_ids: AutomatedReverificationSubjectIds = {
      event_id: ev.id,
      tradeline_id: ev.tradeline_id,
      bureau: ev.source,
    };
    out.push({ event: ev, evidence, subject_ids });
  }
  return out;
}

export async function detectAutomatedReverification(clientId: string): Promise<number> {
  const { data, error } = await tbl('timeline_events')
    .select('id,client_id,category,source,tradeline_id,event_kind,event_date,title,summary,details')
    .eq('client_id', clientId)
    .eq('is_draft', false);
  if (error) throw error;
  const events = (data || []) as EventRow[];
  if (events.length === 0) return 0;

  const matches = findAutomatedReverificationMatches(events);
  if (matches.length === 0) return 0;

  let inserted = 0;
  for (const m of matches) {
    const { error: upErr } = await tbl('diagnostic_signals').upsert(
      {
        client_id: clientId,
        signal_type: 'automated_reverification',
        subject_ids: m.subject_ids,
        evidence: m.evidence,
        severity: 'warning',
      },
      { onConflict: 'client_id,signal_type,subject_ids', ignoreDuplicates: true }
    );
    if (!upErr) inserted += 1;
  }
  return inserted;
}