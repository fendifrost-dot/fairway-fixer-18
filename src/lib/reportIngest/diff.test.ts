/**
 * C6 — Tests for parser + diff classification (tradelines_added /
 * tradelines_updated / tradelines_disappeared).
 */

import { describe, it, expect } from 'vitest';
import { parseReportText } from './parser';
import { diffReportAgainstState } from './diff';
import type { Tradeline, TradelineBureauState } from '@/types/operator';

function tl(p: Partial<Tradeline> & { id: string; display_name: string }): Tradeline {
  return {
    id: p.id,
    client_id: 'c1',
    furnisher_id: null,
    display_name: p.display_name,
    account_last4: p.account_last4 ?? null,
    balance: p.balance ?? null,
    opened_date: p.opened_date ?? null,
    status: p.status ?? 'unknown',
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function st(p: Partial<TradelineBureauState> & {
  tradeline_id: string;
  bureau: TradelineBureauState['bureau'];
}): TradelineBureauState {
  return {
    id: `${p.tradeline_id}-${p.bureau}`,
    tradeline_id: p.tradeline_id,
    bureau: p.bureau,
    present: p.present ?? true,
    status_on_bureau: p.status_on_bureau ?? null,
    last_seen_date: p.last_seen_date ?? null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    operator_disputed: p.operator_disputed ?? false,
    operator_disputed_reason: null,
  };
}

describe('parseReportText', () => {
  it('parses single-bureau block with mixed status formats', () => {
    const blob = `
## Bureau: Experian
## Score: 612
- DISCOVER BANK ****1234 | Charge-off | balance: 439 | opened: 2019-08-01
- SYNERGETIC ****0001 | Collection | balance: 49730
`;
    const r = parseReportText(blob);
    expect(r.bureaus).toEqual(['experian']);
    expect(r.scores.experian).toBe(612);
    expect(r.tradelines).toHaveLength(2);
    expect(r.tradelines[0]).toMatchObject({
      display_name: 'DISCOVER BANK',
      account_last4: '1234',
      status_on_bureau: 'Charge-off',
      balance: 439,
      opened_date: '2019-08-01',
      bureau: 'experian',
    });
    expect(r.tradelines[1].balance).toBe(49730);
    expect(r.tradelines[1].account_last4).toBe('0001');
  });

  it('expands TriMerge header into all three bureaus', () => {
    const r = parseReportText(`## Bureau: TriMerge\n- CAPITAL ONE ****9999 | Open | balance: 100`);
    expect(r.bureaus.sort()).toEqual(['equifax', 'experian', 'transunion']);
    expect(r.tradelines).toHaveLength(3);
    expect(new Set(r.tradelines.map(t => t.bureau))).toEqual(
      new Set(['equifax', 'experian', 'transunion'])
    );
  });

  it('throws when there is no bureau header', () => {
    expect(() => parseReportText('- ACME 1234 | Open')).toThrow(/Bureau/);
  });
});

describe('diffReportAgainstState', () => {
  it('classifies added / updated / unchanged / disappeared correctly', () => {
    const tradelines: Tradeline[] = [
      tl({ id: 't1', display_name: 'DISCOVER BANK', account_last4: '1234' }),
      tl({ id: 't2', display_name: 'CAPITAL ONE', account_last4: '9999' }),
      tl({ id: 't3', display_name: 'OLD AMEX', account_last4: '5555' }),
    ];
    const states: TradelineBureauState[] = [
      st({ tradeline_id: 't1', bureau: 'experian', present: true, status_on_bureau: 'Open' }),
      st({ tradeline_id: 't2', bureau: 'experian', present: true, status_on_bureau: 'Open' }),
      st({ tradeline_id: 't3', bureau: 'experian', present: true, status_on_bureau: 'Open' }),
    ];
    const report = parseReportText(`
## Bureau: Experian
- DISCOVER BANK ****1234 | Charge-off | balance: 439
- CAPITAL ONE ****9999 | Open
- BRAND NEW COLLECTION ****0001 | Collection | balance: 200
`);

    const diff = diffReportAgainstState(report, tradelines, states, '2026-05-07');
    expect(diff.tradelines_added).toBe(1);
    expect(diff.tradelines_updated).toBe(1);    // DISCOVER status changed
    expect(diff.tradelines_unchanged).toBe(1);  // CAPITAL ONE unchanged
    expect(diff.tradelines_disappeared).toBe(1); // OLD AMEX missing

    const added = diff.rows.find(r => r.kind === 'added');
    expect(added?.display_name).toBe('BRAND NEW COLLECTION');
    const disappeared = diff.rows.find(r => r.kind === 'disappeared');
    expect(disappeared?.tradeline_id).toBe('t3');
    expect(disappeared?.after?.present).toBe(false);
  });

  it('skips operator-disputed rows when classifying disappearance', () => {
    const tradelines = [tl({ id: 't1', display_name: 'OLD AMEX', account_last4: '5555' })];
    const states = [
      st({ tradeline_id: 't1', bureau: 'experian', present: true, operator_disputed: true }),
    ];
    const report = parseReportText(`## Bureau: Experian\n- SOMETHING ELSE ****1111 | Open`);
    const diff = diffReportAgainstState(report, tradelines, states, '2026-05-07');
    expect(diff.tradelines_disappeared).toBe(0);
    expect(diff.rows.find(r => r.kind === 'disappeared')).toBeUndefined();
  });

  it('counts an "added" tradeline once even when reported across multiple bureaus', () => {
    const report = parseReportText(`
## Bureau: TriMerge
- BRAND NEW BANK ****8888 | Open | balance: 50
`);
    const diff = diffReportAgainstState(report, [], [], '2026-05-07');
    expect(diff.tradelines_added).toBe(1);
    expect(diff.rows.filter(r => r.kind === 'added')).toHaveLength(3); // one per bureau
  });

  it('only flags disappearance for bureaus the report covers', () => {
    const tradelines = [tl({ id: 't1', display_name: 'OLD AMEX', account_last4: '5555' })];
    const states = [
      st({ tradeline_id: 't1', bureau: 'equifax', present: true }),
      st({ tradeline_id: 't1', bureau: 'experian', present: true }),
    ];
    const report = parseReportText(`## Bureau: Experian\n- SOMETHING ELSE ****1111 | Open`);
    const diff = diffReportAgainstState(report, tradelines, states, '2026-05-07');
    const disappeared = diff.rows.filter(r => r.kind === 'disappeared');
    expect(disappeared).toHaveLength(1);
    expect(disappeared[0].bureau).toBe('experian');
  });
});