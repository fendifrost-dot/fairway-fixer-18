/**
 * C6 — Commit phase: take operator-approved diff rows and write them to the
 * database (tradelines + tradeline_bureau_states), then emit item_appeared /
 * item_disappeared diagnostic signals and re-run C1-C3 detectors.
 *
 * Re-uses ensureTradeline + upsertBureauState semantics from B5.
 */

import { supabase } from '@/integrations/supabase/client';
import { ensureTradeline } from '@/hooks/useTradelines';
import type { ReportDiffRow } from './types';
import type { ParsedReportScores } from './types';
import { detectFurnisherRenames } from '@/lib/diagnostics/furnisherRenames';
import { detectPostRoundNewHarm } from '@/lib/diagnostics/postRoundNewHarm';
import { detectAutomatedReverification } from '@/lib/diagnostics/automatedReverification';

const tbl = (name: string) => (supabase as any).from(name);

export interface CommitRowDecision {
  row: ReportDiffRow;
  /** When false, the operator rejected the change — flag operator_disputed. */
  accept: boolean;
  /** Optional reason when rejected. */
  reject_reason?: string | null;
}

export interface CommitResult {
  tradelines_added: number;
  tradelines_updated: number;
  tradelines_disappeared: number;
  rejected: number;
  scores_updated: boolean;
  signals_emitted: number;
  draft_tradeline_ids: string[];
}

/** Sanitize a string before persisting (untrusted operator paste). */
function sanitize(s: string | null | undefined): string | null {
  if (s == null) return null;
  // Strip control chars, cap length.
  return s.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 500).trim() || null;
}

/**
 * Persist the operator's accepted/rejected decisions for a parsed report.
 */
export async function commitReportDiff(
  clientId: string,
  decisions: CommitRowDecision[],
  scores: ParsedReportScores,
  reportDate: string
): Promise<CommitResult> {
  let added = 0;
  let updated = 0;
  let disappeared = 0;
  let rejected = 0;
  let signalsEmitted = 0;
  const draftIds: string[] = [];

  // Collect signals to insert at the end (deduped via unique constraint, but
  // we also want to avoid re-inserting on every refresh).
  const signalsToInsert: Array<{
    client_id: string;
    signal_type: string;
    subject_ids: Record<string, unknown>;
    evidence: Record<string, unknown>;
    severity: string;
  }> = [];

  for (const d of decisions) {
    if (!d.accept) {
      rejected++;
      // For "updated" / "disappeared" decisions: mark operator_disputed=true on
      // the existing per-bureau state so subsequent reports don't re-flag it.
      if (d.row.tradeline_id) {
        await tbl('tradeline_bureau_states').upsert(
          {
            tradeline_id: d.row.tradeline_id,
            bureau: d.row.bureau,
            present: d.row.before?.present ?? true,
            status_on_bureau: sanitize(d.row.before?.status_on_bureau ?? null),
            last_seen_date: d.row.before?.last_seen_date ?? null,
            operator_disputed: true,
            operator_disputed_reason: sanitize(d.reject_reason || 'rejected from report ingest'),
          },
          { onConflict: 'tradeline_id,bureau' }
        );
      }
      continue;
    }

    if (d.row.kind === 'unchanged') continue;

    if (d.row.kind === 'added' && d.row.after) {
      // Create tradeline as draft (status = 'unknown') if it doesn't exist yet.
      const tl = await ensureTradeline(
        clientId,
        sanitize(d.row.display_name) || 'Unknown',
        d.row.account_last4
      );
      draftIds.push(tl.id);
      const { error } = await tbl('tradeline_bureau_states').upsert(
        {
          tradeline_id: tl.id,
          bureau: d.row.bureau,
          present: true,
          status_on_bureau: sanitize(d.row.after.status_on_bureau),
          last_seen_date: d.row.after.last_seen_date,
          operator_disputed: false,
          operator_disputed_reason: null,
        },
        { onConflict: 'tradeline_id,bureau' }
      );
      if (error) throw error;
      added++;
      signalsToInsert.push({
        client_id: clientId,
        signal_type: 'item_appeared',
        subject_ids: { tradeline_id: tl.id, bureau: d.row.bureau },
        evidence: {
          display_name: tl.display_name,
          account_last4: tl.account_last4,
          status_on_bureau: d.row.after.status_on_bureau,
          report_date: reportDate,
        },
        severity: 'info',
      });
    } else if (d.row.kind === 'updated' && d.row.tradeline_id && d.row.after) {
      const { error } = await tbl('tradeline_bureau_states').upsert(
        {
          tradeline_id: d.row.tradeline_id,
          bureau: d.row.bureau,
          present: true,
          status_on_bureau: sanitize(d.row.after.status_on_bureau),
          last_seen_date: d.row.after.last_seen_date,
          operator_disputed: false,
          operator_disputed_reason: null,
        },
        { onConflict: 'tradeline_id,bureau' }
      );
      if (error) throw error;
      updated++;
    } else if (d.row.kind === 'disappeared' && d.row.tradeline_id) {
      const { error } = await tbl('tradeline_bureau_states').upsert(
        {
          tradeline_id: d.row.tradeline_id,
          bureau: d.row.bureau,
          present: false,
          status_on_bureau: sanitize(d.row.before?.status_on_bureau ?? null),
          last_seen_date: reportDate,
          operator_disputed: false,
          operator_disputed_reason: null,
        },
        { onConflict: 'tradeline_id,bureau' }
      );
      if (error) throw error;
      disappeared++;
      signalsToInsert.push({
        client_id: clientId,
        signal_type: 'item_disappeared',
        subject_ids: { tradeline_id: d.row.tradeline_id, bureau: d.row.bureau },
        evidence: {
          display_name: d.row.display_name,
          account_last4: d.row.account_last4,
          previous_status: d.row.before?.status_on_bureau ?? null,
          report_date: reportDate,
        },
        severity: 'info',
      });
    }
  }

  // Update credit_scores on the client when the report carried any.
  let scoresUpdated = false;
  const scorePatch: Record<string, number | string> = {};
  if (scores.equifax) scorePatch.equifax_score = scores.equifax;
  if (scores.experian) scorePatch.experian_score = scores.experian;
  if (scores.transunion) scorePatch.transunion_score = scores.transunion;
  if (Object.keys(scorePatch).length > 0) {
    scorePatch.scores_updated_at = new Date().toISOString();
    const { error } = await tbl('clients').update(scorePatch).eq('id', clientId);
    if (!error) {
      scoresUpdated = true;
      // Also write a score_history row per bureau for trend analysis (C4).
      const histRows = [
        scores.equifax && { bureau: 'equifax', score: scores.equifax },
        scores.experian && { bureau: 'experian', score: scores.experian },
        scores.transunion && { bureau: 'transunion', score: scores.transunion },
      ]
        .filter(Boolean)
        .map((r: any) => ({
          client_id: clientId,
          bureau: r.bureau,
          score: r.score,
          score_date: reportDate,
          source: 'report_ingest',
        }));
      if (histRows.length > 0) {
        await tbl('score_history').insert(histRows);
      }
    }
  }

  if (signalsToInsert.length > 0) {
    const { error } = await tbl('diagnostic_signals').insert(signalsToInsert);
    if (!error) signalsEmitted = signalsToInsert.length;
  }

  // Re-run downstream detectors against the new state.
  try { await detectFurnisherRenames(clientId); } catch { /* best-effort */ }
  try { await detectPostRoundNewHarm(clientId); } catch { /* best-effort */ }
  try { await detectAutomatedReverification(clientId); } catch { /* best-effort */ }

  return {
    tradelines_added: added,
    tradelines_updated: updated,
    tradelines_disappeared: disappeared,
    rejected,
    scores_updated: scoresUpdated,
    signals_emitted: signalsEmitted,
    draft_tradeline_ids: draftIds,
  };
}