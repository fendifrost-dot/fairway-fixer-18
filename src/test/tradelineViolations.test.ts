import { describe, expect, it } from 'vitest';
import { analyzeTradelineViolations } from '@/lib/creditReport/tradelineViolations';

describe('analyzeTradelineViolations', () => {
  it('flags unrated/bankruptcy $0 accounts with clean payment grid', () => {
    const violations = analyzeTradelineViolations([
      {
        id: 'tl-1',
        furnisher_raw: 'JPMCB AUTO',
        account_mask: '****1234',
        balance: 0,
        account_status: 'Unrated or bankruptcy',
        two_year_payment_grid: [
          { month: '2024-01', status: 'OK' },
          { month: '2024-02', status: 'OK' },
        ],
      },
    ]);

    expect(violations.some((v) => v.type === 'data_quality_anomaly')).toBe(true);
    expect(violations[0]?.narrative).toMatch(/JPMCB AUTO/i);
  });

  it('flags impossible isolated delinquency', () => {
    const violations = analyzeTradelineViolations([
      {
        furnisher_raw: 'DISCOVER BANK',
        account_mask: '****1234',
        two_year_payment_grid: [
          { month: '2024-01', status: 'OK' },
          { month: '2024-02', status: '60' },
          { month: '2024-03', status: 'OK' },
        ],
      },
    ]);

    expect(violations.some((v) => v.type === 'impossible_payment_progression')).toBe(true);
  });
});
