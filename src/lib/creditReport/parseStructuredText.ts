/**
 * Parse structured credit report text into canonical tradeline rows.
 * Handles PrivacyGuard tri-merge and single-bureau paste formats.
 */

import {
  dedupeTradelineRows,
  normalizeAccountMask,
  normalizeDateOpened,
  normalizeFurnisher,
  normalizeText,
  type CreditBureau,
  type PaymentGridEntry,
  type TradelineRow,
} from './tradelineIdentity';

export interface ParseStructuredTextOptions {
  default_bureau?: CreditBureau;
  strict?: boolean;
}

export interface ParseStructuredTextResult {
  rows: TradelineRow[];
  bureau_detected: CreditBureau | 'tri_merge' | null;
  report_date: string | null;
  warnings: Array<{ line: string; reason: string }>;
}

const BUREAU_HEADER = /^(?:#{1,3}\s*)?(Equifax|Experian|TransUnion)\s*:?\s*$/i;
const REPORT_DATE = /report\s*date\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i;
const PAYMENT_GRID = /^(\d{4}-\d{2}|\w{3}\s+\d{4})\s*[:\|]\s*(OK|30|60|90|120|CO|ND|\*|\?)/i;

function toBureau(name: string): CreditBureau {
  const n = name.toLowerCase();
  if (n.startsWith('equifax')) return 'equifax';
  if (n.startsWith('experian')) return 'experian';
  return 'transunion';
}

function parseMoney(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parsePipeTradeline(line: string, bureau: CreditBureau): TradelineRow | null {
  const parts = line.split('|').map((p) => p.trim());
  if (parts.length < 3) return null;

  const furnisher_raw = parts[0];
  const account_mask = parts[1] || '';
  const date_opened = parts[2] || '';

  const row: TradelineRow = {
    furnisher_raw,
    furnisher_normalized: normalizeFurnisher(furnisher_raw),
    bureau,
    account_mask: normalizeAccountMask(account_mask),
    date_opened: normalizeDateOpened(date_opened),
    parse_confidence: 0.85,
  };

  for (let i = 3; i < parts.length; i++) {
    const seg = parts[i];
    const lower = seg.toLowerCase();
    if (lower.startsWith('balance:')) row.balance = parseMoney(seg.split(':')[1]);
    else if (lower.startsWith('high:') || lower.startsWith('high_balance:')) {
      row.high_balance = parseMoney(seg.split(':')[1]);
    } else if (lower.startsWith('payment:') || lower.startsWith('monthly:')) {
      row.monthly_payment = parseMoney(seg.split(':')[1]);
    } else if (lower.startsWith('status:')) row.account_status = seg.split(':').slice(1).join(':').trim();
    else if (lower.startsWith('pay:')) row.pay_status = seg.split(':').slice(1).join(':').trim();
    else if (lower.startsWith('type:')) row.loan_type = seg.split(':').slice(1).join(':').trim();
    else if (lower.startsWith('reported:')) row.date_reported = normalizeDateOpened(seg.split(':')[1]);
  }

  if (!row.furnisher_raw || !row.date_opened) return null;
  return row;
}

function parseDashTradeline(line: string, bureau: CreditBureau): TradelineRow | null {
  const segments = line.split(/\s+-\s+/).map((s) => s.trim());
  if (segments.length < 3) return null;

  const furnisher_raw = segments[0];
  const account_mask = segments[1];
  const date_opened = segments[2];

  const row: TradelineRow = {
    furnisher_raw,
    furnisher_normalized: normalizeFurnisher(furnisher_raw),
    bureau,
    account_mask: normalizeAccountMask(account_mask),
    date_opened: normalizeDateOpened(date_opened),
    parse_confidence: 0.8,
  };

  for (let i = 3; i < segments.length; i++) {
    const seg = segments[i];
    if (/^\$/.test(seg)) {
      if (row.balance == null) row.balance = parseMoney(seg);
      else if (row.high_balance == null) row.high_balance = parseMoney(seg);
    } else if (/current|open|closed|charge/i.test(seg)) {
      row.account_status = seg;
    }
  }

  if (!row.furnisher_raw || !row.date_opened) return null;
  return row;
}

function parsePaymentGridLine(line: string): PaymentGridEntry | null {
  const m = line.match(PAYMENT_GRID);
  if (!m) return null;
  let month = m[1];
  if (/^\w{3}\s+\d{4}$/.test(month)) {
    const d = new Date(`${month.replace(/\s+/, ' 1, ')}`);
    if (!Number.isNaN(d.getTime())) {
      month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  return { month, status: m[2].toUpperCase() as PaymentGridEntry['status'] };
}

export function parseStructuredCreditReportText(
  text: string,
  options: ParseStructuredTextOptions = {},
): ParseStructuredTextResult {
  const warnings: ParseStructuredTextResult['warnings'] = [];
  const rows: TradelineRow[] = [];
  let currentBureau: CreditBureau = options.default_bureau ?? 'transunion';
  let bureau_detected: ParseStructuredTextResult['bureau_detected'] = null;
  let report_date: string | null = null;
  const bureausSeen = new Set<CreditBureau>();

  let pendingRow: TradelineRow | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const dateMatch = line.match(REPORT_DATE);
    if (dateMatch) {
      report_date = normalizeDateOpened(dateMatch[1]);
      continue;
    }

    const bureauMatch = line.match(BUREAU_HEADER);
    if (bureauMatch) {
      if (pendingRow?.two_year_payment_grid?.length) {
        rows.push(pendingRow);
        pendingRow = null;
      }
      currentBureau = toBureau(bureauMatch[1]);
      bureausSeen.add(currentBureau);
      continue;
    }

    const gridEntry = parsePaymentGridLine(line);
    if (gridEntry && pendingRow) {
      pendingRow.two_year_payment_grid = pendingRow.two_year_payment_grid ?? [];
      pendingRow.two_year_payment_grid.push(gridEntry);
      continue;
    }

    let parsed: TradelineRow | null = null;
    if (line.includes('|')) parsed = parsePipeTradeline(line, currentBureau);
    else if (line.includes(' - ')) parsed = parseDashTradeline(line, currentBureau);

    if (parsed) {
      if (pendingRow) rows.push(pendingRow);
      pendingRow = parsed;
      continue;
    }

    if (options.strict) {
      warnings.push({ line, reason: 'Unrecognized tradeline line' });
    }
  }

  if (pendingRow) rows.push(pendingRow);

  if (bureausSeen.size === 1) bureau_detected = [...bureausSeen][0];
  else if (bureausSeen.size > 1) bureau_detected = 'tri_merge';

  const deduped = dedupeTradelineRows(rows);

  if (deduped.length < rows.length) {
    warnings.push({
      line: '',
      reason: `Collapsed ${rows.length - deduped.length} duplicate identity rows (same composite key)`,
    });
  }

  return { rows: deduped, bureau_detected, report_date, warnings };
}

/** Parse furnisher/bureau update text into outcome metadata */
export interface FurnisherUpdateParseResult {
  bureau?: CreditBureau;
  furnisher?: string;
  result: 'verified' | 'updated' | 'deleted' | 'no-response' | 'frivolous' | 'unknown';
  date?: string;
  affected_accounts: string[];
  free_text: string;
}

const RESULT_PATTERNS: Array<{ pattern: RegExp; result: FurnisherUpdateParseResult['result'] }> = [
  { pattern: /\b(deleted|removed|deletion)\b/i, result: 'deleted' },
  { pattern: /\b(updated|modified|corrected)\b/i, result: 'updated' },
  { pattern: /\b(verified|confirmed accurate)\b/i, result: 'verified' },
  { pattern: /\b(frivolous|irrelevant)\b/i, result: 'frivolous' },
  { pattern: /\b(no response|failed to respond)\b/i, result: 'no-response' },
];

export function parseFurnisherUpdateText(text: string): FurnisherUpdateParseResult {
  let result: FurnisherUpdateParseResult['result'] = 'unknown';
  for (const { pattern, result: r } of RESULT_PATTERNS) {
    if (pattern.test(text)) {
      result = r;
      break;
    }
  }

  const bureauMatch = text.match(/\b(Equifax|Experian|TransUnion)\b/i);
  const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/);

  const accountMatches = [...text.matchAll(/\b(\d{6,}\*{2,}\d{0,4}|\*{4}\d{4})\b/g)].map((m) => m[1]);

  return {
    bureau: bureauMatch ? toBureau(bureauMatch[1]) : undefined,
    result,
    date: dateMatch ? normalizeDateOpened(dateMatch[1]) : undefined,
    affected_accounts: accountMatches,
    free_text: text.trim(),
  };
}
