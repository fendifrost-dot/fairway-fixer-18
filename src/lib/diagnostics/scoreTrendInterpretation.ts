/**
 * C4 — Score-trend interpretation.
 *
 * Heuristic attribution of a per-bureau score change to tradeline removals
 * (score up) or new derogatory tradelines (score down). Not exact FICO math.
 *
 * Pure function `interpretScoreTrendPure` accepts loaded data so it stays
 * unit-testable. `interpretScoreTrend` is the convenience wrapper that
 * loads from Supabase.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  Tradeline,
  TradelineBureauState,
  TradelineBureau,
  ScoreAttribution,
  ScoreTrendInterpretation,
  DiagnosticSignal,
  PostRoundNewHarmSubjectIds,
} from '@/types/operator';

const tbl = (name: string) => (supabase as any).from(name);

interface ScoreHistoryRow {
  id: string;
  bureau: string; // display name
  score: number;
  score_date: string; // YYYY-MM-DD
}

const BUREAU_DISPLAY: Record<TradelineBureau, string[]> = {
  equifax: ['equifax'],
  experian: ['experian'],
  transunion: ['transunion', 'trans union'],
};

function isCollection(text: string): boolean {
  return /collection|collect/i.test(text);
}
function isChargeOff(text: string): boolean {
  return /charge[-\s]?off|charged off/i.test(text);
}
function isLate(text: string): boolean {
  return /late|past due|delinquen/i.test(text);
}
function isFraud(text: string): boolean {
  return /fraud/i.test(text);
}
function isPaidAsAgreed(text: string): boolean {
  return /paid as agreed|paid\b|current\b|never late/i.test(text);
}

function pointsForRemoval(displayName: string, statusOnBureau: string | null): number {
  const blob = `${displayName} ${statusOnBureau || ''}`;
  if (isCollection(blob) || isChargeOff(blob)) return 25;
  if (isFraud(blob)) return 15;
  if (isPaidAsAgreed(blob)) return 5;
  return 10;
}

function pointsForAddition(displayName: string, statusOnBureau: string | null): number {
  const blob = `${displayName} ${statusOnBureau || ''}`;
  if (isCollection(blob)) return 25;
  if (isChargeOff(blob)) return 25;
  if (isLate(blob)) return 15;
  return 10;
}

function inRange(iso: string | null | undefined, fromMs: number, toMs: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t > fromMs && t <= toMs;
}

function bureauMatches(bureau: TradelineBureau, displayBureau: string): boolean {
  const v = displayBureau.trim().toLowerCase();
  return BUREAU_DISPLAY[bureau].includes(v);
}

export interface InterpretInput {
  bureau: TradelineBureau;
  currentScore: number;
  currentAsOf: string | null; // YYYY-MM-DD
  history: ScoreHistoryRow[];
  tradelines: Tradeline[];
  states: TradelineBureauState[];
  signals: DiagnosticSignal[];
}

export function interpretScoreTrendPure(input: InterpretInput): ScoreTrendInterpretation {
  const { bureau, currentScore, currentAsOf, history, tradelines, states, signals } = input;

  // Find the prior point for this bureau (most-recent BEFORE currentAsOf).
  const bureauHist = history
    .filter(h => bureauMatches(bureau, h.bureau))
    .slice()
    .sort((a, b) => a.score_date.localeCompare(b.score_date));

  const currentMs = currentAsOf ? new Date(currentAsOf).getTime() : Date.now();
  let prior: ScoreHistoryRow | null = null;
  for (let i = bureauHist.length - 1; i >= 0; i--) {
    const h = bureauHist[i];
    const hMs = new Date(h.score_date).getTime();
    if (hMs < currentMs && h.score !== currentScore) { prior = h; break; }
  }

  const result: ScoreTrendInterpretation = {
    bureau,
    current_score: currentScore,
    current_as_of: currentAsOf,
    prior_score: prior?.score ?? null,
    prior_as_of: prior?.score_date ?? null,
    delta: prior ? currentScore - prior.score : null,
    attributions: [],
  };
  if (!prior) return result;

  const fromMs = new Date(prior.score_date).getTime();
  const toMs = currentMs;
  const delta = result.delta!;

  const tlById = new Map(tradelines.map(t => [t.id, t] as const));
  const bureauStates = states.filter(s => s.bureau === bureau);

  // Index post_round_new_harm signals by tradeline id (for cross-link).
  const harmSignalByTl = new Map<string, DiagnosticSignal>();
  for (const sig of signals) {
    if (sig.signal_type !== 'post_round_new_harm' || sig.dismissed_at) continue;
    const sub = sig.subject_ids as PostRoundNewHarmSubjectIds;
    if (sub?.tradeline_id) harmSignalByTl.set(sub.tradeline_id, sig);
  }

  const candidates: ScoreAttribution[] = [];

  if (delta > 0) {
    // REMOVALS: present on this bureau, last_seen_date in (prior, current]
    for (const s of bureauStates) {
      const tl = tlById.get(s.tradeline_id);
      if (!tl) continue;
      const removed =
        (s.present === false && inRange(s.last_seen_date, fromMs, toMs)) ||
        (s.present === false && tl.status === 'deleted' && inRange(tl.updated_at, fromMs, toMs));
      if (!removed) continue;
      const pts = pointsForRemoval(tl.display_name, s.status_on_bureau);
      candidates.push({
        type: 'tradeline_removed',
        est_pts: pts,
        label: `deleted ${labelizeKind(tl.display_name, s.status_on_bureau)}: ${tl.display_name}`,
        tradeline_id: tl.id,
        bureau_status: s.status_on_bureau,
      });
    }
  } else if (delta < 0) {
    // ADDITIONS: present=true on this bureau, first appearance in window.
    for (const s of bureauStates) {
      const tl = tlById.get(s.tradeline_id);
      if (!tl || !s.present) continue;
      const added =
        inRange(tl.created_at, fromMs, toMs) ||
        inRange(s.created_at, fromMs, toMs);
      if (!added) continue;
      // Only attribute derogatory additions
      const blob = `${tl.display_name} ${s.status_on_bureau || ''}`;
      if (!(isCollection(blob) || isChargeOff(blob) || isLate(blob))) continue;
      const pts = -pointsForAddition(tl.display_name, s.status_on_bureau);
      const harmSig = harmSignalByTl.get(tl.id);
      candidates.push({
        type: 'tradeline_added',
        est_pts: pts,
        label: `new ${labelizeKind(tl.display_name, s.status_on_bureau)}: ${tl.display_name}${tl.balance ? ` $${Math.round(tl.balance).toLocaleString()}` : ''}`,
        tradeline_id: tl.id,
        signal_id: harmSig?.id,
        bureau_status: s.status_on_bureau,
      });
    }
  }

  // Cap signed-sum to actual delta direction (don't over-attribute).
  candidates.sort((a, b) => Math.abs(b.est_pts) - Math.abs(a.est_pts));
  let running = 0;
  const capped: ScoreAttribution[] = [];
  const sign = Math.sign(delta);
  const absDelta = Math.abs(delta);
  for (const c of candidates) {
    if (Math.sign(c.est_pts) !== sign) { capped.push(c); continue; }
    const remaining = absDelta - Math.abs(running);
    if (remaining <= 0) {
      // Keep but zero the contribution beyond the cap
      capped.push({ ...c, est_pts: 0 });
      continue;
    }
    const allowed = Math.min(Math.abs(c.est_pts), remaining);
    const adj = sign * allowed;
    capped.push({ ...c, est_pts: adj });
    running += adj;
  }

  // Residual (EX/EQ): if attributed magnitude doesn't equal |delta|, add an "other factors" line.
  if (bureau === 'experian' || bureau === 'equifax') {
    const accounted = capped.reduce((acc, c) => acc + c.est_pts, 0);
    const residual = delta - accounted;
    if (residual !== 0) {
      capped.push({
        type: 'other',
        est_pts: residual,
        label: 'other factors (utilization / age / inquiries)',
      });
    }
  }

  capped.sort((a, b) => Math.abs(b.est_pts) - Math.abs(a.est_pts));
  result.attributions = capped;
  return result;
}

function labelizeKind(displayName: string, statusOnBureau: string | null): string {
  const blob = `${displayName} ${statusOnBureau || ''}`;
  if (isCollection(blob)) return 'collection';
  if (isChargeOff(blob)) return 'charge-off';
  if (isLate(blob)) return 'late';
  if (isFraud(blob)) return 'fraud-tagged item';
  if (isPaidAsAgreed(blob)) return 'paid account';
  return 'tradeline';
}

export async function interpretScoreTrend(
  clientId: string,
  bureau: TradelineBureau,
  currentScore: number,
  currentAsOf: string | null
): Promise<ScoreTrendInterpretation> {
  const [{ data: hist }, { data: tls }, { data: ss }, { data: sigs }] = await Promise.all([
    tbl('score_history').select('id,bureau,score,score_date').eq('client_id', clientId).order('score_date', { ascending: true }),
    tbl('tradelines').select('*').eq('client_id', clientId),
    tbl('tradeline_bureau_states').select('*'),
    tbl('diagnostic_signals').select('*').eq('client_id', clientId),
  ]);

  const tradelines = (tls || []) as Tradeline[];
  const tlIds = new Set(tradelines.map(t => t.id));
  const states = ((ss || []) as TradelineBureauState[]).filter(s => tlIds.has(s.tradeline_id));

  return interpretScoreTrendPure({
    bureau,
    currentScore,
    currentAsOf,
    history: (hist || []) as ScoreHistoryRow[],
    tradelines,
    states,
    signals: (sigs || []) as DiagnosticSignal[],
  });
}