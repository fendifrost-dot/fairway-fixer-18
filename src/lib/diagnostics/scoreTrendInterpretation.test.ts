import { describe, it, expect } from 'vitest';
import { interpretScoreTrendPure } from './scoreTrendInterpretation';
import type { Tradeline, TradelineBureauState } from '@/types/operator';

function tl(overrides: Partial<Tradeline> = {}): Tradeline {
  return {
    id: 'tl-1',
    client_id: 'c1',
    furnisher_id: null,
    display_name: 'Capital One',
    account_last4: null,
    balance: 0,
    opened_date: null,
    status: 'active',
    notes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as Tradeline;
}

function st(overrides: Partial<TradelineBureauState> = {}): TradelineBureauState {
  return {
    id: 's-1',
    tradeline_id: 'tl-1',
    bureau: 'experian',
    present: true,
    status_on_bureau: null,
    last_seen_date: null,
    notes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as TradelineBureauState;
}

describe('interpretScoreTrendPure', () => {
  it('returns null delta when no prior history exists', () => {
    const result = interpretScoreTrendPure({
      bureau: 'experian',
      currentScore: 700,
      currentAsOf: '2025-06-01',
      history: [],
      tradelines: [],
      states: [],
      signals: [],
    });
    expect(result.delta).toBeNull();
    expect(result.attributions).toEqual([]);
  });

  it('selects the most recent strictly-earlier history entry as prior', () => {
    const result = interpretScoreTrendPure({
      bureau: 'experian',
      currentScore: 720,
      currentAsOf: '2025-06-01',
      history: [
        { id: '1', bureau: 'experian', score: 700, score_date: '2025-04-01' },
        { id: '2', bureau: 'experian', score: 715, score_date: '2025-05-01' },
      ],
      tradelines: [],
      states: [],
      signals: [],
    });
    expect(result.prior_score).toBe(715);
    expect(result.delta).toBe(5);
  });

  it('does NOT skip a prior entry that happens to equal the current score', () => {
    const result = interpretScoreTrendPure({
      bureau: 'experian',
      currentScore: 720,
      currentAsOf: '2025-06-01',
      history: [
        { id: '1', bureau: 'experian', score: 720, score_date: '2025-04-01' },
        { id: '2', bureau: 'experian', score: 715, score_date: '2025-05-01' },
        { id: '3', bureau: 'experian', score: 720, score_date: '2025-06-01' },
      ],
      tradelines: [],
      states: [],
      signals: [],
    });
    expect(result.prior_score).toBe(715);
    expect(result.delta).toBe(5);
  });

  it('attributes a removed collection to a positive delta', () => {
    const result = interpretScoreTrendPure({
      bureau: 'experian',
      currentScore: 725,
      currentAsOf: '2025-06-01',
      history: [
        { id: '1', bureau: 'experian', score: 700, score_date: '2025-05-01' },
      ],
      tradelines: [
        tl({
          id: 'tl-coll',
          display_name: 'Portfolio Recovery',
          status: 'deleted',
          updated_at: '2025-05-15T00:00:00Z',
        }),
      ],
      states: [
        st({
          tradeline_id: 'tl-coll',
          bureau: 'experian',
          present: false,
          status_on_bureau: 'collection',
          last_seen_date: '2025-05-15',
        }),
      ],
      signals: [],
    });
    const removal = result.attributions.find(a => a.type === 'tradeline_removed');
    expect(removal).toBeDefined();
    expect(removal!.est_pts).toBeGreaterThan(0);
  });

  it('attributes a new derogatory addition to a negative delta', () => {
    const result = interpretScoreTrendPure({
      bureau: 'experian',
      currentScore: 680,
      currentAsOf: '2025-06-01',
      history: [
        { id: '1', bureau: 'experian', score: 700, score_date: '2025-05-01' },
      ],
      tradelines: [
        tl({
          id: 'tl-new',
          display_name: 'Midland Credit',
          balance: 1200,
          created_at: '2025-05-20T00:00:00Z',
        }),
      ],
      states: [
        st({
          tradeline_id: 'tl-new',
          bureau: 'experian',
          present: true,
          status_on_bureau: 'collection',
          created_at: '2025-05-20T00:00:00Z',
        }),
      ],
      signals: [],
    });
    const addition = result.attributions.find(a => a.type === 'tradeline_added');
    expect(addition).toBeDefined();
    expect(addition!.est_pts).toBeLessThan(0);
  });

  it('caps signed attribution sum to the actual delta magnitude', () => {
    const result = interpretScoreTrendPure({
      bureau: 'experian',
      currentScore: 730,
      currentAsOf: '2025-06-01',
      history: [
        { id: '1', bureau: 'experian', score: 700, score_date: '2025-05-01' },
      ],
      tradelines: [
        tl({ id: 'tl-a', display_name: 'Coll A', status: 'deleted', updated_at: '2025-05-15T00:00:00Z' }),
        tl({ id: 'tl-b', display_name: 'Coll B', status: 'deleted', updated_at: '2025-05-20T00:00:00Z' }),
      ],
      states: [
        st({ id: 's-a', tradeline_id: 'tl-a', bureau: 'experian', present: false, status_on_bureau: 'collection', last_seen_date: '2025-05-15' }),
        st({ id: 's-b', tradeline_id: 'tl-b', bureau: 'experian', present: false, status_on_bureau: 'collection', last_seen_date: '2025-05-20' }),
      ],
      signals: [],
    });
    const sumSameDirection = result.attributions
      .filter(a => a.type !== 'other')
      .reduce((acc, a) => acc + a.est_pts, 0);
    expect(sumSameDirection).toBe(30);
  });

  it('adds an "other factors" residual line for Experian/Equifax when attribution is incomplete', () => {
    const result = interpretScoreTrendPure({
      bureau: 'experian',
      currentScore: 730,
      currentAsOf: '2025-06-01',
      history: [
        { id: '1', bureau: 'experian', score: 700, score_date: '2025-05-01' },
      ],
      tradelines: [],
      states: [],
      signals: [],
    });
    const other = result.attributions.find(a => a.type === 'other');
    expect(other).toBeDefined();
    expect(other!.est_pts).toBe(30);
  });

  it('does NOT add an "other factors" residual for TransUnion', () => {
    const result = interpretScoreTrendPure({
      bureau: 'transunion',
      currentScore: 730,
      currentAsOf: '2025-06-01',
      history: [
        { id: '1', bureau: 'transunion', score: 700, score_date: '2025-05-01' },
      ],
      tradelines: [],
      states: [],
      signals: [],
    });
    expect(result.attributions.find(a => a.type === 'other')).toBeUndefined();
  });

  it('matches "trans union" display name to the transunion bureau', () => {
    const result = interpretScoreTrendPure({
      bureau: 'transunion',
      currentScore: 720,
      currentAsOf: '2025-06-01',
      history: [
        { id: '1', bureau: 'Trans Union', score: 700, score_date: '2025-05-01' },
      ],
      tradelines: [],
      states: [],
      signals: [],
    });
    expect(result.prior_score).toBe(700);
    expect(result.delta).toBe(20);
  });
});