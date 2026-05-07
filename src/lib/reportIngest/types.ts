/**
 * C6 — Source-document upload + cross-check (Phase 1: paste structured text).
 *
 * Shared type definitions for the report-ingest pipeline.
 */

import type { TradelineBureau } from '@/types/operator';

/** A single tradeline row parsed out of an uploaded credit report. */
export interface ParsedReportTradeline {
  display_name: string;
  account_last4: string | null;
  /** Free-text status the bureau printed (e.g. "Charge-off", "Paid", "Open"). */
  status_on_bureau: string | null;
  balance: number | null;
  opened_date: string | null;
  /** Which bureau column this row came from. */
  bureau: TradelineBureau;
}

/** Optional bureau score header parsed from the report. */
export interface ParsedReportScores {
  equifax?: number;
  experian?: number;
  transunion?: number;
}

export interface ParsedReport {
  /** Bureaus actually covered by this report (1-3). */
  bureaus: TradelineBureau[];
  tradelines: ParsedReportTradeline[];
  scores: ParsedReportScores;
}

/** Classification of one parsed row vs current Guardian state. */
export type DiffKind =
  | 'added'           // tradeline new to Guardian
  | 'updated'         // tradeline exists, but bureau-state changed
  | 'unchanged'       // tradeline exists, bureau-state matches
  | 'disappeared';    // tradeline existed, NOT in this report (per-bureau)

export interface ReportDiffRow {
  kind: DiffKind;
  bureau: TradelineBureau;
  /** Existing tradeline id when kind != 'added'. */
  tradeline_id: string | null;
  display_name: string;
  account_last4: string | null;
  before: {
    present: boolean | null;
    status_on_bureau: string | null;
    last_seen_date: string | null;
  } | null;
  after: {
    present: boolean;
    status_on_bureau: string | null;
    last_seen_date: string;
  } | null;
  /** True if this bureau-state was previously operator_disputed and should be skipped. */
  operator_disputed: boolean;
}

export interface ReportDiffSummary {
  rows: ReportDiffRow[];
  tradelines_added: number;
  tradelines_updated: number;
  tradelines_disappeared: number;
  tradelines_unchanged: number;
}