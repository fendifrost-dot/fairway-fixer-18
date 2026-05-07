/**
 * C6 — Pure diff function: classify each parsed report row vs current state.
 *
 * Inputs are plain arrays so this is trivially unit-testable.
 */

import type {
  Tradeline,
  TradelineBureau,
  TradelineBureauState,
} from '@/types/operator';
import type {
  ParsedReport,
  ParsedReportTradeline,
  ReportDiffRow,
  ReportDiffSummary,
} from './types';

/** Normalize for fuzzy match: collapse whitespace, casefold, strip punctuation. */
function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the existing tradeline that matches a parsed row.
 * Match priority:
 *   1. exact normalized display_name + same account_last4
 *   2. exact normalized display_name + (parsed last4 null OR existing last4 null)
 *   3. account_last4 exact match alone (last4 must be present on both sides)
 */
export function findExistingTradeline(
  parsed: ParsedReportTradeline,
  tradelines: Tradeline[]
): Tradeline | null {
  const pn = normName(parsed.display_name);
  const pl = parsed.account_last4 || null;

  // 1. name + last4 exact
  if (pl) {
    const m = tradelines.find(
      t => normName(t.display_name) === pn && t.account_last4 === pl
    );
    if (m) return m;
  }

  // 2. name with one side missing last4
  const nameOnly = tradelines.find(
    t => normName(t.display_name) === pn && (!pl || !t.account_last4)
  );
  if (nameOnly) return nameOnly;

  // 3. last4 alone
  if (pl) {
    const last4Only = tradelines.find(t => t.account_last4 === pl);
    if (last4Only) return last4Only;
  }

  return null;
}

function statesEqual(
  before: { present: boolean | null; status_on_bureau: string | null },
  after: { present: boolean; status_on_bureau: string | null }
): boolean {
  return before.present === after.present &&
    (before.status_on_bureau || '') === (after.status_on_bureau || '');
}

/**
 * Build a per-bureau diff between a parsed report and current Guardian state.
 *
 * @param report           Parsed report (defines which bureaus are covered).
 * @param tradelines       Existing tradelines for the client.
 * @param bureauStates     Existing per-bureau state rows.
 * @param reportDate       ISO date string used as last_seen_date for matched rows.
 */
export function diffReportAgainstState(
  report: ParsedReport,
  tradelines: Tradeline[],
  bureauStates: TradelineBureauState[],
  reportDate: string
): ReportDiffSummary {
  const rows: ReportDiffRow[] = [];

  // Index existing states by (tradeline_id, bureau) for fast lookup.
  const stateKey = (tid: string, b: TradelineBureau) => `${tid}::${b}`;
  const stateMap = new Map<string, TradelineBureauState>();
  for (const s of bureauStates) {
    stateMap.set(stateKey(s.tradeline_id, s.bureau), s);
  }

  // Track which existing (tradeline, bureau) pairs we've matched in this report.
  const matchedPairs = new Set<string>();

  // Walk parsed rows.
  for (const p of report.tradelines) {
    const existing = findExistingTradeline(p, tradelines);
    const after = {
      present: true,
      status_on_bureau: p.status_on_bureau,
      last_seen_date: reportDate,
    };
    if (existing) {
      const key = stateKey(existing.id, p.bureau);
      matchedPairs.add(key);
      const prev = stateMap.get(key);
      const before = prev
        ? {
            present: prev.present,
            status_on_bureau: prev.status_on_bureau,
            last_seen_date: prev.last_seen_date,
          }
        : null;
      const operatorDisputed = !!prev?.operator_disputed;
      const unchanged = before
        ? statesEqual(before, after)
        : false;
      rows.push({
        kind: unchanged ? 'unchanged' : 'updated',
        bureau: p.bureau,
        tradeline_id: existing.id,
        display_name: existing.display_name,
        account_last4: existing.account_last4,
        before,
        after,
        operator_disputed: operatorDisputed,
      });
    } else {
      rows.push({
        kind: 'added',
        bureau: p.bureau,
        tradeline_id: null,
        display_name: p.display_name,
        account_last4: p.account_last4,
        before: null,
        after,
        operator_disputed: false,
      });
    }
  }

  // Walk existing states for the bureaus the report COVERS — anything we
  // didn't touch above and was previously present is "disappeared" on that bureau.
  const coveredBureaus = new Set<TradelineBureau>(report.bureaus);
  for (const s of bureauStates) {
    if (!coveredBureaus.has(s.bureau)) continue;
    const key = stateKey(s.tradeline_id, s.bureau);
    if (matchedPairs.has(key)) continue;
    if (s.present !== true) continue;
    if (s.operator_disputed) continue;
    const tl = tradelines.find(t => t.id === s.tradeline_id);
    rows.push({
      kind: 'disappeared',
      bureau: s.bureau,
      tradeline_id: s.tradeline_id,
      display_name: tl?.display_name || '(unknown)',
      account_last4: tl?.account_last4 ?? null,
      before: {
        present: s.present,
        status_on_bureau: s.status_on_bureau,
        last_seen_date: s.last_seen_date,
      },
      after: {
        present: false,
        status_on_bureau: s.status_on_bureau,
        last_seen_date: reportDate,
      },
      operator_disputed: false,
    });
  }

  // Sort: changes first (added → disappeared → updated → unchanged), then by name.
  const order: Record<ReportDiffRow['kind'], number> = {
    added: 0, disappeared: 1, updated: 2, unchanged: 3,
  };
  rows.sort((a, b) =>
    order[a.kind] - order[b.kind] ||
    a.display_name.localeCompare(b.display_name) ||
    a.bureau.localeCompare(b.bureau)
  );

  // De-dup "added" so each unique (display_name + last4) tradeline only counts
  // once toward tradelines_added even if it appears in multiple bureau columns.
  const addedKeys = new Set<string>();
  let added = 0;
  for (const r of rows) {
    if (r.kind !== 'added') continue;
    const k = `${normName(r.display_name)}::${r.account_last4 || ''}`;
    if (!addedKeys.has(k)) { addedKeys.add(k); added++; }
  }

  // Likewise count unique tradelines updated / disappeared.
  const updatedTids = new Set<string>();
  const disappearedTids = new Set<string>();
  const unchangedTids = new Set<string>();
  for (const r of rows) {
    if (!r.tradeline_id) continue;
    if (r.kind === 'updated') updatedTids.add(r.tradeline_id);
    else if (r.kind === 'disappeared') disappearedTids.add(r.tradeline_id);
    else if (r.kind === 'unchanged') unchangedTids.add(r.tradeline_id);
  }

  return {
    rows,
    tradelines_added: added,
    tradelines_updated: updatedTids.size,
    tradelines_disappeared: disappearedTids.size,
    tradelines_unchanged: unchangedTids.size,
  };
}