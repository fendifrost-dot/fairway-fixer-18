import { describe, it, expect } from 'vitest';
import {
  buildTradelineIdentityKey,
  dedupeTradelineRows,
  type TradelineRow,
} from '@/lib/creditReport/tradelineIdentity';
import { diffCreditReport } from '@/lib/creditReport/creditReportDiff';

/** Nicole Yancy — 7 MOHELA tradelines, two shared masks, distinct date_opened + balance */
const NICOLE_MOHELA: TradelineRow[] = [
  { furnisher_raw: 'MOHELA/SERVICING', furnisher_normalized: 'mohela', bureau: 'transunion', account_mask: '502935047818****', date_opened: '2004-09-07', balance: 16672, high_balance: 16672, loan_type: 'student loan', parse_confidence: 0.9 },
  { furnisher_raw: 'MOHELA/SERVICING', furnisher_normalized: 'mohela', bureau: 'transunion', account_mask: '502935047818****', date_opened: '2005-09-06', balance: 68496, high_balance: 68496, loan_type: 'student loan', parse_confidence: 0.9 },
  { furnisher_raw: 'MOHELA/SERVICING', furnisher_normalized: 'mohela', bureau: 'transunion', account_mask: '502935047818****', date_opened: '2005-11-22', balance: 7609, high_balance: 7609, loan_type: 'student loan', parse_confidence: 0.9 },
  { furnisher_raw: 'MOHELA/SERVICING', furnisher_normalized: 'mohela', bureau: 'transunion', account_mask: '502935047818****', date_opened: '2006-06-05', balance: 46556, high_balance: 46556, loan_type: 'student loan', parse_confidence: 0.9 },
  { furnisher_raw: 'MOHELA/SERVICING', furnisher_normalized: 'mohela', bureau: 'transunion', account_mask: '502935047818****', date_opened: '2006-09-01', balance: 7214, high_balance: 7214, loan_type: 'student loan', parse_confidence: 0.9 },
  { furnisher_raw: 'MOHELA/SERVICING', furnisher_normalized: 'mohela', bureau: 'transunion', account_mask: '502935070148****', date_opened: '2006-12-26', balance: 21472, high_balance: 21472, loan_type: 'student loan', parse_confidence: 0.9 },
  { furnisher_raw: 'MOHELA/SERVICING', furnisher_normalized: 'mohela', bureau: 'transunion', account_mask: '502935070148****', date_opened: '2007-02-16', balance: 12281, high_balance: 12281, loan_type: 'student loan', parse_confidence: 0.9 },
];

const OTHER_TRADELINES: TradelineRow[] = [
  { furnisher_raw: 'DISCOVER BANK', furnisher_normalized: 'discover bank', bureau: 'transunion', account_mask: '6011****4390', date_opened: '2018-03-15', balance: 439, parse_confidence: 0.9 },
  { furnisher_raw: 'CAPITAL ONE', furnisher_normalized: 'capital one', bureau: 'transunion', account_mask: '5425****1234', date_opened: '2019-01-10', balance: 1200, parse_confidence: 0.9 },
];

describe('tradelineIdentity', () => {
  it('keeps 7 Nicole MOHELA loans distinct despite shared masks', () => {
    const keys = NICOLE_MOHELA.map(buildTradelineIdentityKey);
    expect(new Set(keys).size).toBe(7);
    expect(dedupeTradelineRows(NICOLE_MOHELA)).toHaveLength(7);
  });

  it('does not collapse rows that differ only by date_opened', () => {
    const a = NICOLE_MOHELA[0];
    const b = NICOLE_MOHELA[1];
    expect(buildTradelineIdentityKey(a)).not.toBe(buildTradelineIdentityKey(b));
  });

  it('dedupes true duplicates (same composite key)', () => {
    const dupe = { ...NICOLE_MOHELA[0], parse_confidence: 0.5 };
    const result = dedupeTradelineRows([NICOLE_MOHELA[0], dupe]);
    expect(result).toHaveLength(1);
    expect(result[0].parse_confidence).toBe(0.9);
  });
});

describe('creditReportDiff', () => {
  const fullSnapshot = [...NICOLE_MOHELA, ...OTHER_TRADELINES];

  it('partial MOHELA paste: 0 disappeared for unrelated tradelines', () => {
    const partialMohela = NICOLE_MOHELA.map((r) => ({ ...r, balance: (r.balance ?? 0) + 1 }));
    const diff = diffCreditReport(fullSnapshot, partialMohela, {
      scope: 'partial_update',
      bureau: 'transunion',
      report_date: '2026-05-26',
    });
    expect(diff.summary.disappeared).toBe(0);
    expect(diff.absent_in_latest).toHaveLength(0);
    expect(diff.updated.length).toBe(7);
    expect(diff.added).toHaveLength(0);
  });

  it('furnisher_update scope only touches MOHELA rows', () => {
    const mohelaUpdate = NICOLE_MOHELA.slice(0, 2).map((r) => ({ ...r, pay_status: 'Current' }));
    const diff = diffCreditReport(fullSnapshot, mohelaUpdate, {
      scope: 'furnisher_update',
      bureau: 'transunion',
      report_date: '2026-05-26',
      furnisher_filter: 'mohela',
    });
    expect(diff.summary.disappeared).toBe(0);
    expect(diff.updated.length + diff.unchanged.length + diff.added.length).toBeLessThanOrEqual(2);
  });

  it('full_snapshot marks absent_in_latest but never deletes', () => {
    const reduced = NICOLE_MOHELA.slice(0, 5);
    const diff = diffCreditReport(fullSnapshot, reduced, {
      scope: 'full_snapshot',
      bureau: 'transunion',
      report_date: '2026-05-26',
    });
    expect(diff.absent_in_latest.length).toBeGreaterThan(0);
    expect(diff.absent_in_latest.every((a) => a.status === 'absent_in_latest')).toBe(true);
    // Other bureau rows unaffected — all existing are transunion in fixture
    expect(diff.summary.added).toBe(0);
  });

  it('re-import same report is idempotent (0 added, 0 updated)', () => {
    const diff = diffCreditReport(fullSnapshot, fullSnapshot, {
      scope: 'full_snapshot',
      bureau: 'transunion',
      report_date: '2026-05-26',
    });
    expect(diff.summary.added).toBe(0);
    expect(diff.summary.updated).toBe(0);
    expect(diff.summary.disappeared).toBe(0);
  });
});
