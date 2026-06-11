/**
 * Composite tradeline identity — never dedupe by masked account number alone.
 * Nicole Yancy: 7 MOHELA loans share mask 502935047818**** but differ on date_opened + balance.
 */

export type CreditBureau = 'equifax' | 'experian' | 'transunion';

export interface TradelineRow {
  furnisher_raw: string;
  furnisher_normalized: string;
  bureau: CreditBureau;
  account_mask: string;
  date_opened: string;
  date_reported?: string;
  balance?: number | null;
  high_balance?: number | null;
  past_due?: number | null;
  monthly_payment?: number | null;
  loan_type?: string | null;
  pay_status?: string | null;
  account_status?: string | null;
  remarks?: string[];
  two_year_payment_grid?: PaymentGridEntry[];
  dispute_flags?: string[];
  parse_confidence?: number;
}

export interface PaymentGridEntry {
  month: string; // YYYY-MM
  status: 'OK' | '30' | '60' | '90' | '120' | 'CO' | 'ND' | string;
}

const FURNISHER_ALIASES: Record<string, string> = {
  mohela: 'mohela',
  'mohela/navient': 'mohela',
  'mohela/servicing': 'mohela',
  navient: 'navient',
  'bank of america': 'bank of america',
  bofa: 'bank of america',
};

/** Normalize for fingerprinting: lowercase, collapse whitespace, trim */
export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normalizeFurnisher(raw: string): string {
  const n = normalizeText(raw);
  return FURNISHER_ALIASES[n] ?? n;
}

export function normalizeAccountMask(mask: string): string {
  return mask.replace(/\s+/g, '').toUpperCase();
}

export function normalizeDateOpened(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return trimmed;
}

function normalizeBalance(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return String(Math.round(value));
}

/**
 * Composite identity key for idempotent upsert.
 * Includes furnisher + mask + date_opened + high_balance (+ loan_type when present).
 */
export function buildTradelineIdentityKey(row: Pick<
  TradelineRow,
  'furnisher_normalized' | 'account_mask' | 'date_opened' | 'high_balance' | 'balance' | 'loan_type' | 'bureau'
> & { furnisher_raw?: string }): string {
  const furnisher = normalizeFurnisher(row.furnisher_normalized || row.furnisher_raw || '');
  const mask = normalizeAccountMask(row.account_mask || '');
  const opened = normalizeDateOpened(row.date_opened || '');
  const highBal = normalizeBalance(row.high_balance ?? row.balance);
  const loanType = normalizeText(row.loan_type || '');
  return `${row.bureau}|${furnisher}|${mask}|${opened}|${highBal}|${loanType}`;
}

/** Deduplicate parsed rows by composite identity — keeps highest parse_confidence */
export function dedupeTradelineRows(rows: TradelineRow[]): TradelineRow[] {
  const byKey = new Map<string, TradelineRow>();
  for (const row of rows) {
    const key = buildTradelineIdentityKey(row);
    const existing = byKey.get(key);
    if (!existing || (row.parse_confidence ?? 0) > (existing.parse_confidence ?? 0)) {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values());
}

export function indexTradelinesByIdentity(rows: TradelineRow[]): Map<string, TradelineRow> {
  const map = new Map<string, TradelineRow>();
  for (const row of rows) {
    map.set(buildTradelineIdentityKey(row), row);
  }
  return map;
}
