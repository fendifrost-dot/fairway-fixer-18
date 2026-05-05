/**
 * C2 — Post-round new-harm detector.
 *
 * Between Round N (submitted) and now, find derogatory tradelines that:
 *  - Were created in Guardian (tradelines.created_at) AFTER round.submitted_at
 *  - Have opened_date < round.submitted_at (the underlying account predates the round)
 *  - Were NOT disputed in round N (no timeline_events with event_kind='action'
 *    AND round_id=round.id AND tradeline_id=tl.id)
 *  - Are derogatory: status in ('disputed','active') AND any
 *    bureau_state.status_on_bureau matches collection / charge-off / public record,
 *    OR display_name itself contains those keywords.
 *
 * Persists into diagnostic_signals (signal_type='post_round_new_harm') with
 * the unique (client_id, signal_type, subject_ids) constraint deduping re-runs.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  Tradeline,
  TradelineBureauState,
  DisputeRound,
  PostRoundNewHarmSubjectIds,
  PostRoundNewHarmEvidence,
} from '@/types/operator';

const tbl = (name: string) => (supabase as any).from(name);

const DEROG_KEYWORDS = ['collection', 'charge off', 'charge-off', 'charged off', 'public record'];

function isDerogatoryName(name: string): boolean {
  const n = name.toLowerCase();
  return DEROG_KEYWORDS.some(k => n.includes(k));
}

function isDerogatoryStatus(s: string | null | undefined): boolean {
  if (!s) return false;
  const v = s.toLowerCase();
  return DEROG_KEYWORDS.some(k => v.includes(k));
}

function daysBetweenISO(later: string, earlier: string): number {
  const a = new Date(later).getTime();
  const b = new Date(earlier).getTime();
  return Math.max(0, Math.round((a - b) / 86400000));
}

export interface PostRoundNewHarmMatch {
  round: DisputeRound;
  tradeline: Tradeline;
  evidence: PostRoundNewHarmEvidence;
}

export function findPostRoundNewHarmMatches(
  rounds: DisputeRound[],
  tradelines: Tradeline[],
  states: TradelineBureauState[],
  disputedTradelinesByRound: Map<string, Set<string>>
): PostRoundNewHarmMatch[] {
  const out: PostRoundNewHarmMatch[] = [];
  const statesByTl = new Map<string, TradelineBureauState[]>();
  for (const s of states) {
    const arr = statesByTl.get(s.tradeline_id) || [];
    arr.push(s);
    statesByTl.set(s.tradeline_id, arr);
  }

  for (const round of rounds) {
    if (!round.submitted_at) continue;
    const submittedISO = round.submitted_at;
    const submittedMs = new Date(submittedISO).getTime();
    const disputedSet = disputedTradelinesByRound.get(round.id) || new Set<string>();

    for (const tl of tradelines) {
      // Created in Guardian after the round was submitted
      const createdMs = new Date(tl.created_at).getTime();
      if (!(createdMs > submittedMs)) continue;

      // Underlying account predates the round
      if (!tl.opened_date) continue;
      const openedMs = new Date(tl.opened_date).getTime();
      if (!(openedMs < submittedMs)) continue;

      // Not disputed in this round
      if (disputedSet.has(tl.id)) continue;

      // Derogatory check
      const statusDerog = tl.status === 'disputed' || tl.status === 'active';
      const bureauStates = statesByTl.get(tl.id) || [];
      const bureauStatusDerog = bureauStates.some(s => isDerogatoryStatus(s.status_on_bureau));
      const nameDerog = isDerogatoryName(tl.display_name);
      if (!nameDerog && !(statusDerog && bureauStatusDerog)) continue;

      const days = daysBetweenISO(tl.created_at, submittedISO);
      const evidence: PostRoundNewHarmEvidence = {
        opened_date: tl.opened_date,
        first_seen_at: tl.created_at,
        round_submitted_at: submittedISO,
        days_after_round_submission: days,
        display_name: tl.display_name,
        round_number: round.round_number,
      };
      out.push({ round, tradeline: tl, evidence });
    }
  }
  return out;
}

export async function detectPostRoundNewHarm(clientId: string): Promise<number> {
  // Load rounds
  const { data: rs, error: e1 } = await tbl('dispute_rounds')
    .select('*')
    .eq('client_id', clientId)
    .order('round_number', { ascending: true });
  if (e1) throw e1;
  const rounds = ((rs || []) as DisputeRound[]).filter(r => !!r.submitted_at);
  if (rounds.length === 0) return 0;

  // Load tradelines
  const { data: tls, error: e2 } = await tbl('tradelines').select('*').eq('client_id', clientId);
  if (e2) throw e2;
  const tradelines = (tls || []) as Tradeline[];
  if (tradelines.length === 0) return 0;

  // Load states
  const ids = tradelines.map(t => t.id);
  const { data: ss, error: e3 } = await tbl('tradeline_bureau_states')
    .select('*')
    .in('tradeline_id', ids);
  if (e3) throw e3;
  const states = (ss || []) as TradelineBureauState[];

  // Load action events to determine which tradelines were disputed in each round
  const roundIds = rounds.map(r => r.id);
  const { data: evs, error: e4 } = await tbl('timeline_events')
    .select('id,round_id,tradeline_id,event_kind')
    .eq('client_id', clientId)
    .eq('event_kind', 'action')
    .in('round_id', roundIds);
  if (e4) throw e4;
  const disputedByRound = new Map<string, Set<string>>();
  for (const ev of (evs || []) as { round_id: string | null; tradeline_id: string | null }[]) {
    if (!ev.round_id || !ev.tradeline_id) continue;
    const set = disputedByRound.get(ev.round_id) || new Set<string>();
    set.add(ev.tradeline_id);
    disputedByRound.set(ev.round_id, set);
  }

  const matches = findPostRoundNewHarmMatches(rounds, tradelines, states, disputedByRound);
  if (matches.length === 0) return 0;

  let inserted = 0;
  for (const m of matches) {
    const subject_ids: PostRoundNewHarmSubjectIds = {
      round_id: m.round.id,
      tradeline_id: m.tradeline.id,
    };
    const { error } = await tbl('diagnostic_signals').upsert(
      {
        client_id: clientId,
        signal_type: 'post_round_new_harm',
        subject_ids,
        evidence: m.evidence,
        severity: 'critical',
      },
      { onConflict: 'client_id,signal_type,subject_ids', ignoreDuplicates: true }
    );
    if (!error) inserted += 1;
  }
  return inserted;
}