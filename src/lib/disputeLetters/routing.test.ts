import { describe, it, expect } from 'vitest';
import {
  suggestLetterTypeForRound,
  citationsForLetterType,
  pickRoundInitialTargets,
  pickVerifyOrDeleteTargets,
  buildStoragePath,
  slugify,
} from './routing';

const MS_DAY = 86400000;

describe('suggestLetterTypeForRound', () => {
  it('verified items → verify_or_delete', () => {
    expect(
      suggestLetterTypeForRound({
        round: { status: 'response_received', submitted_at: '2026-04-01' },
        hasVerifiedItems: true,
        hasAutomatedReverificationSignal: false,
        hasFurnisherRenameSignal: false,
        hasPostRoundNewHarmSignal: false,
      })
    ).toBe('verify_or_delete');
  });

  it('automated_reverification signal → verify_or_delete even without verified items', () => {
    expect(
      suggestLetterTypeForRound({
        round: { status: 'mailed', submitted_at: '2026-04-01' },
        hasVerifiedItems: false,
        hasAutomatedReverificationSignal: true,
        hasFurnisherRenameSignal: false,
        hasPostRoundNewHarmSignal: false,
      })
    ).toBe('verify_or_delete');
  });

  it('mailed >30d ago, no response → overdue_violation', () => {
    const today = new Date('2026-05-15').getTime();
    expect(
      suggestLetterTypeForRound({
        round: { status: 'mailed', submitted_at: '2026-04-01' },
        todayMs: today,
        hasVerifiedItems: false,
        hasAutomatedReverificationSignal: false,
        hasFurnisherRenameSignal: false,
        hasPostRoundNewHarmSignal: false,
      })
    ).toBe('overdue_violation');
  });

  it('mailed <30d ago → does NOT trigger overdue_violation', () => {
    const today = new Date('2026-04-15').getTime();
    expect(
      suggestLetterTypeForRound({
        round: { status: 'mailed', submitted_at: '2026-04-01' },
        todayMs: today,
        hasVerifiedItems: false,
        hasAutomatedReverificationSignal: false,
        hasFurnisherRenameSignal: false,
        hasPostRoundNewHarmSignal: false,
      })
    ).not.toBe('overdue_violation');
  });

  it('post_round_new_harm without higher-priority signals → round_n_initial', () => {
    expect(
      suggestLetterTypeForRound({
        round: { status: 'planning', submitted_at: null },
        hasVerifiedItems: false,
        hasAutomatedReverificationSignal: false,
        hasFurnisherRenameSignal: false,
        hasPostRoundNewHarmSignal: true,
      })
    ).toBe('round_n_initial');
  });

  it('default for planning rounds is round_n_initial', () => {
    expect(
      suggestLetterTypeForRound({
        round: { status: 'planning', submitted_at: null },
        hasVerifiedItems: false,
        hasAutomatedReverificationSignal: false,
        hasFurnisherRenameSignal: false,
        hasPostRoundNewHarmSignal: false,
      })
    ).toBe('round_n_initial');
  });
});

describe('citationsForLetterType', () => {
  it('verify_or_delete cites Cushman + §1681i(a)(7)', () => {
    const c = citationsForLetterType('verify_or_delete');
    expect(c.some(s => s.includes('Cushman'))).toBe(true);
    expect(c.some(s => s.includes('1681i(a)(7)'))).toBe(true);
  });

  it('overdue_violation cites the 30-day window', () => {
    const c = citationsForLetterType('overdue_violation');
    expect(c.some(s => s.includes('1681i(a)(1)'))).toBe(true);
  });

  it('furnisher_direct cites §1681s-2(b) and §1681c(c)(1)', () => {
    const c = citationsForLetterType('furnisher_direct');
    expect(c.some(s => s.includes('1681s-2(b)'))).toBe(true);
    expect(c.some(s => s.includes('1681c(c)(1)'))).toBe(true);
  });
});

describe('pickRoundInitialTargets', () => {
  const tradelines = [
    { id: 't1', display_name: 'Discover', account_last4: '1234', balance: 500, opened_date: '2020-01-01' },
    { id: 't2', display_name: 'MOHELA', account_last4: '9999', balance: 0, opened_date: '2018-09-01' },
    { id: 't3', display_name: 'Cap One', account_last4: '0000', balance: 100, opened_date: '2021-05-01' },
  ];
  const states = [
    { tradeline_id: 't1', bureau: 'experian', present: true, status_on_bureau: 'Open' },
    { tradeline_id: 't2', bureau: 'experian', present: true, status_on_bureau: 'Verified' },
    { tradeline_id: 't3', bureau: 'equifax', present: true, status_on_bureau: 'Open' },
  ];

  it('returns only present tradelines on the chosen bureau', () => {
    const out = pickRoundInitialTargets({
      bureau: 'Experian',
      tradelines,
      states,
      events: [],
      round_id: 'r1',
    });
    expect(out.map(t => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('excludes tradelines already disputed in this round', () => {
    const out = pickRoundInitialTargets({
      bureau: 'Experian',
      tradelines,
      states,
      events: [
        { id: 'e1', category: 'Action', source: 'Experian', tradeline_id: 't1', round_id: 'r1' },
      ],
      round_id: 'r1',
    });
    expect(out.map(t => t.id)).toEqual(['t2']);
  });
});

describe('pickVerifyOrDeleteTargets', () => {
  const tradelines = [
    { id: 't1', display_name: 'Discover', account_last4: '1234', balance: 500, opened_date: null },
    { id: 't2', display_name: 'Synergetic', account_last4: '4444', balance: 49730, opened_date: null },
  ];

  it('matches verified/updated/confirmed status tokens', () => {
    const out = pickVerifyOrDeleteTargets({
      bureau: 'Experian',
      tradelines,
      states: [
        { tradeline_id: 't1', bureau: 'experian', present: true, status_on_bureau: 'Updated' },
        { tradeline_id: 't2', bureau: 'experian', present: true, status_on_bureau: 'Open / Past Due' },
      ],
    });
    expect(out.map(o => o.tradeline.id)).toEqual(['t1']);
    expect(out[0].status_on_bureau).toBe('Updated');
  });

  it('ignores other bureaus', () => {
    const out = pickVerifyOrDeleteTargets({
      bureau: 'Equifax',
      tradelines,
      states: [
        { tradeline_id: 't1', bureau: 'experian', present: true, status_on_bureau: 'Verified' },
      ],
    });
    expect(out).toEqual([]);
  });
});

describe('storage path + slug', () => {
  it('builds expected storage path', () => {
    const p = buildStoragePath('client-uuid', 2, 'verify_or_delete', 'experian', new Date('2026-05-06T12:00:00Z'));
    expect(p).toBe('client-uuid/2/verify_or_delete-experian-2026-05-06.docx');
  });

  it('slugifies messy names', () => {
    expect(slugify('Synergetic Communications, Inc.')).toBe('synergetic-communications-inc');
    expect(slugify('   ')).toBe('item');
  });
});
