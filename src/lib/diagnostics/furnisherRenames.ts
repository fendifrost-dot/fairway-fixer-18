/**
 * C1 — Cosmetic furnisher-rename detector.
 *
 * For each bureau, find tradelines flagged "no longer reporting" (present=false)
 * that look suspiciously similar to a different "now reporting" (present=true)
 * tradeline on the same client+bureau — same account_last4, opened_date within
 * ~7 days, balance within 5%, but a different display_name / furnisher.
 *
 * Persists results into diagnostic_signals (signal_type='furnisher_rename').
 * The unique constraint (client_id, signal_type, subject_ids) makes this safe
 * to re-run; existing signals are not duplicated.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  Tradeline,
  TradelineBureau,
  TradelineBureauState,
  FurnisherRenameSubjectIds,
  FurnisherRenameEvidence,
} from '@/types/operator';

const tbl = (name: string) => (supabase as any).from(name);

const BUREAUS: TradelineBureau[] = ['equifax', 'experian', 'transunion'];

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.abs(Math.round((da - db) / 86400000));
}

function pctDelta(a: number, b: number): number {
  const base = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / base;
}

export interface FurnisherRenameSignal {
  bureau: TradelineBureau;
  deleted_tradeline_id: string;
  new_tradeline_id: string;
  evidence: FurnisherRenameEvidence;
}

export function findFurnisherRenameMatches(
  tradelines: Tradeline[],
  states: TradelineBureauState[]
): FurnisherRenameSignal[] {
  const tlById = new Map(tradelines.map(t => [t.id, t] as const));
  const out: FurnisherRenameSignal[] = [];

  for (const bureau of BUREAUS) {
    const statesForBureau = states.filter(s => s.bureau === bureau);
    const deleted = statesForBureau.filter(s => s.present === false);
    const present = statesForBureau.filter(s => s.present === true);

    for (const dState of deleted) {
      const tOld = tlById.get(dState.tradeline_id);
      if (!tOld) continue;

      for (const pState of present) {
        if (pState.tradeline_id === dState.tradeline_id) continue;
        const tNew = tlById.get(pState.tradeline_id);
        if (!tNew) continue;

        // Must differ by name OR furnisher
        const sameName = tOld.display_name.trim().toLowerCase() === tNew.display_name.trim().toLowerCase();
        const sameFurn = (tOld.furnisher_id || null) === (tNew.furnisher_id || null);
        if (sameName && sameFurn) continue;

        // account_last4: when both present, must match exactly
        if (tOld.account_last4 && tNew.account_last4 && tOld.account_last4 !== tNew.account_last4) continue;

        // opened_date: when both present, within 7 days; if only one side has, allow
        let openedDelta: number | null = null;
        if (tOld.opened_date && tNew.opened_date) {
          openedDelta = daysBetween(tOld.opened_date, tNew.opened_date);
          if (openedDelta > 7) continue;
        }

        // balance: when both present, within 5%
        let balDelta: number | null = null;
        if (tOld.balance != null && tNew.balance != null) {
          balDelta = pctDelta(Number(tOld.balance), Number(tNew.balance));
          if (balDelta > 0.05) continue;
        }

        // Need at least ONE corroborating signal beyond the name/furnisher diff.
        const hasCorroboration =
          (tOld.account_last4 && tNew.account_last4 && tOld.account_last4 === tNew.account_last4) ||
          openedDelta != null ||
          balDelta != null;
        if (!hasCorroboration) continue;

        out.push({
          bureau,
          deleted_tradeline_id: tOld.id,
          new_tradeline_id: tNew.id,
          evidence: {
            matched_account_last4: tOld.account_last4 && tNew.account_last4 ? tOld.account_last4 : null,
            opened_date_delta_days: openedDelta,
            balance_delta_pct: balDelta,
            old_display_name: tOld.display_name,
            new_display_name: tNew.display_name,
          },
        });
      }
    }
  }
  return out;
}

export async function detectFurnisherRenames(clientId: string): Promise<number> {
  // Load tradelines + states
  const { data: tls, error: e1 } = await tbl('tradelines').select('*').eq('client_id', clientId);
  if (e1) throw e1;
  const tradelines = (tls || []) as Tradeline[];
  if (tradelines.length === 0) return 0;

  const ids = tradelines.map(t => t.id);
  const { data: ss, error: e2 } = await tbl('tradeline_bureau_states')
    .select('*')
    .in('tradeline_id', ids);
  if (e2) throw e2;
  const states = (ss || []) as TradelineBureauState[];

  const matches = findFurnisherRenameMatches(tradelines, states);
  if (matches.length === 0) return 0;

  // Upsert each (client_id, signal_type, subject_ids) — unique constraint dedups.
  let inserted = 0;
  for (const m of matches) {
    const subject_ids: FurnisherRenameSubjectIds = {
      bureau: m.bureau,
      tradeline_old: m.deleted_tradeline_id,
      tradeline_new: m.new_tradeline_id,
    };
    const { error } = await tbl('diagnostic_signals').upsert(
      {
        client_id: clientId,
        signal_type: 'furnisher_rename',
        subject_ids,
        evidence: m.evidence,
        severity: 'warning',
      },
      { onConflict: 'client_id,signal_type,subject_ids', ignoreDuplicates: true }
    );
    if (!error) inserted += 1;
  }
  return inserted;
}