/**
 * Scoped credit report diff — partial imports must never mark unrelated tradelines "disappeared".
 */

import {
  buildTradelineIdentityKey,
  indexTradelinesByIdentity,
  type CreditBureau,
  type TradelineRow,
} from './tradelineIdentity.ts';

export type ImportScope = 'full_snapshot' | 'partial_update' | 'furnisher_update';

export interface DiffExistingRow extends TradelineRow {
  id?: string;
}

export interface TradelineUpdate {
  identity_key: string;
  before: DiffExistingRow;
  after: TradelineRow;
  changed_fields: string[];
}

export interface TradelineAbsent {
  identity_key: string;
  existing: DiffExistingRow;
  /** Non-destructive flag — never delete on commit */
  status: 'absent_in_latest';
}

export interface CreditReportDiffResult {
  scope: ImportScope;
  bureau: CreditBureau;
  report_date: string;
  added: TradelineRow[];
  updated: TradelineUpdate[];
  absent_in_latest: TradelineAbsent[];
  unchanged: TradelineRow[];
  summary: {
    added: number;
    updated: number;
    absent_in_latest: number;
    unchanged: number;
    /** Legacy alias — same as absent_in_latest count; never implies deletion */
    disappeared: number;
  };
}

function fieldChanged(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify(a) !== JSON.stringify(b);
  }
  return a !== b;
}

const TRACKED_FIELDS: (keyof TradelineRow)[] = [
  'balance',
  'high_balance',
  'past_due',
  'monthly_payment',
  'pay_status',
  'account_status',
  'date_reported',
  'remarks',
  'two_year_payment_grid',
  'dispute_flags',
  'parse_confidence',
];

function detectChangedFields(before: DiffExistingRow, after: TradelineRow): string[] {
  const changed: string[] = [];
  for (const field of TRACKED_FIELDS) {
    if (fieldChanged(before[field], after[field])) {
      changed.push(field);
    }
  }
  return changed;
}

export interface DiffOptions {
  scope: ImportScope;
  bureau: CreditBureau;
  report_date: string;
  /** Required for partial_update / furnisher_update — only diff within this furnisher */
  furnisher_filter?: string;
  /** For full_snapshot: prior snapshot must be same bureau to infer absence */
  prior_report_date?: string;
}

/**
 * Compare incoming parsed rows against existing DB snapshot.
 * - partial_update / furnisher_update: never emit absent_in_latest for rows outside import set
 * - full_snapshot (same bureau): mark rows missing from paste as absent_in_latest (not deleted)
 */
export function diffCreditReport(
  existing: DiffExistingRow[],
  incoming: TradelineRow[],
  options: DiffOptions,
): CreditReportDiffResult {
  const { scope, bureau, report_date } = options;

  const existingForBureau = existing.filter((r) => r.bureau === bureau);
  const incomingForBureau = incoming.filter((r) => r.bureau === bureau);

  let filteredExisting = existingForBureau;
  let filteredIncoming = incomingForBureau;

  if (scope === 'furnisher_update' && options.furnisher_filter) {
    const f = options.furnisher_filter.toLowerCase();
    filteredExisting = existingForBureau.filter((r) =>
      r.furnisher_normalized.toLowerCase().includes(f) ||
      r.furnisher_raw.toLowerCase().includes(f)
    );
    filteredIncoming = incomingForBureau.filter((r) =>
      r.furnisher_normalized.toLowerCase().includes(f) ||
      r.furnisher_raw.toLowerCase().includes(f)
    );
  } else if (scope === 'partial_update') {
    const incomingKeys = new Set(incomingForBureau.map(buildTradelineIdentityKey));
    filteredExisting = existingForBureau.filter((r) => incomingKeys.has(buildTradelineIdentityKey(r)));
  }

  const existingIndex = indexTradelinesByIdentity(filteredExisting);
  const incomingIndex = indexTradelinesByIdentity(filteredIncoming);

  const added: TradelineRow[] = [];
  const updated: TradelineUpdate[] = [];
  const unchanged: TradelineRow[] = [];
  const absent_in_latest: TradelineAbsent[] = [];

  for (const [key, after] of incomingIndex) {
    const before = existingIndex.get(key);
    if (!before) {
      added.push(after);
      continue;
    }
    const changed_fields = detectChangedFields(before, after);
    if (changed_fields.length > 0) {
      updated.push({ identity_key: key, before, after, changed_fields });
    } else {
      unchanged.push(after);
    }
  }

  const shouldMarkAbsent =
    scope === 'full_snapshot' &&
    (!options.prior_report_date || options.prior_report_date <= report_date);

  if (shouldMarkAbsent) {
    for (const [key, row] of existingIndex) {
      if (!incomingIndex.has(key)) {
        absent_in_latest.push({
          identity_key: key,
          existing: row,
          status: 'absent_in_latest',
        });
      }
    }
  }

  return {
    scope,
    bureau,
    report_date,
    added,
    updated,
    absent_in_latest,
    unchanged,
    summary: {
      added: added.length,
      updated: updated.length,
      absent_in_latest: absent_in_latest.length,
      unchanged: unchanged.length,
      disappeared: absent_in_latest.length,
    },
  };
}
