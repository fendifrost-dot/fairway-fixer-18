import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// ── Mock supabase ──────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

// ── Import after mock ─────────────────────────────────────────────────

import { useBaseline, useBaselineTargets } from './useBaseline';

// ── Helpers ───────────────────────────────────────────────────────────

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

const CLIENT_ID = 'c1111111-1111-1111-1111-111111111111';

/** Helper to wait for queries to settle */
async function flushQueries() {
  await vi.waitFor(() => {}, { timeout: 100 });
  // Small delay for React Query to process
  await new Promise((r) => setTimeout(r, 50));
}

/** Build standard mock chains for both active + history queries */
function setupQueryMocks() {
  const maybeSingleFn = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq2Fn = vi.fn().mockReturnValue({ maybeSingle: maybeSingleFn });
  const eq1Fn = vi.fn().mockReturnValue({ eq: eq2Fn });
  const selectActiveFn = vi.fn().mockReturnValue({ eq: eq1Fn });

  const orderFn = vi.fn().mockResolvedValue({ data: [], error: null });
  const eqHistFn = vi.fn().mockReturnValue({ order: orderFn });
  const selectHistFn = vi.fn().mockReturnValue({ eq: eqHistFn });

  let callCount = 0;
  mockFrom.mockImplementation(() => {
    callCount++;
    if (callCount === 1) return { select: selectActiveFn };
    return { select: selectHistFn };
  });

  return { maybeSingleFn, eq1Fn, eq2Fn, selectActiveFn, orderFn, eqHistFn, selectHistFn };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('useBaseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('active query uses client_id + is_active=true + maybeSingle()', async () => {
    const { eq1Fn, eq2Fn, maybeSingleFn } = setupQueryMocks();

    renderHook(() => useBaseline(CLIENT_ID), { wrapper: createWrapper() });
    await flushQueries();

    expect(eq1Fn).toHaveBeenCalledWith('client_id', CLIENT_ID);
    expect(eq2Fn).toHaveBeenCalledWith('is_active', true);
    expect(maybeSingleFn).toHaveBeenCalled();
  });

  it('history query orders by created_at desc', async () => {
    const { orderFn } = setupQueryMocks();

    renderHook(() => useBaseline(CLIENT_ID), { wrapper: createWrapper() });
    await flushQueries();

    expect(orderFn).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('commitBaseline calls RPC with correct params and returns baseline_id', async () => {
    setupQueryMocks();
    mockRpc.mockResolvedValue({
      data: { baseline_id: 'new-baseline-uuid', targets_inserted: 2 },
      error: null,
    });

    const { result } = renderHook(() => useBaseline(CLIENT_ID), { wrapper: createWrapper() });
    await flushQueries();

    let baselineId: string | undefined;
    await act(async () => {
      baselineId = await result.current.commitBaseline.mutateAsync({
        sourceType: 'chatgpt',
        originalText: 'raw text here',
        targets: [
          { bureau: 'Equifax', item_type: 'account', label: 'Chase', fingerprint: 'fp1', raw_fields: { a: 1 } },
          { bureau: 'Experian', item_type: 'inquiry', label: 'Amex', fingerprint: 'fp2' },
        ],
      });
    });

    expect(baselineId).toBe('new-baseline-uuid');
    expect(mockRpc).toHaveBeenCalledWith('commit_baseline', {
      _client_id: CLIENT_ID,
      _source_type: 'chatgpt',
      _original_text: 'raw text here',
      _targets: [
        { bureau: 'Equifax', item_type: 'account', label: 'Chase', fingerprint: 'fp1', raw_fields: { a: 1 }, status: 'pending' },
        { bureau: 'Experian', item_type: 'inquiry', label: 'Amex', fingerprint: 'fp2', raw_fields: {}, status: 'pending' },
      ],
    });
  });

  it('dedupes targets by fingerprint before RPC call', async () => {
    setupQueryMocks();
    mockRpc.mockResolvedValue({
      data: { baseline_id: 'bl-id', targets_inserted: 1 },
      error: null,
    });

    const { result } = renderHook(() => useBaseline(CLIENT_ID), { wrapper: createWrapper() });
    await flushQueries();

    await act(async () => {
      await result.current.commitBaseline.mutateAsync({
        sourceType: 'manual',
        originalText: 'text',
        targets: [
          { bureau: 'Equifax', item_type: 'account', label: 'Chase', fingerprint: 'dup-fp' },
          { bureau: 'Equifax', item_type: 'account', label: 'Chase DUPE', fingerprint: 'dup-fp' },
          { bureau: 'Experian', item_type: 'inquiry', label: 'Other', fingerprint: 'unique-fp' },
        ],
      });
    });

    const rpcPayload = mockRpc.mock.calls[0][1]._targets;
    expect(rpcPayload).toHaveLength(2);
    expect(rpcPayload[0].label).toBe('Chase');
    expect(rpcPayload[1].fingerprint).toBe('unique-fp');
  });

  it('throws on RPC error with code 23505', async () => {
    setupQueryMocks();
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    });

    const { result } = renderHook(() => useBaseline(CLIENT_ID), { wrapper: createWrapper() });
    await flushQueries();

    await expect(
      act(() =>
        result.current.commitBaseline.mutateAsync({
          sourceType: 'manual',
          originalText: 'text',
          targets: [{ bureau: 'Equifax', item_type: 'account', label: 'X', fingerprint: 'fp' }],
        })
      )
    ).rejects.toEqual({ code: '23505', message: 'duplicate key value violates unique constraint' });
  });
});

describe('useBaselineTargets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries baseline_targets by baseline_id', async () => {
    const eqFn = vi.fn().mockResolvedValue({ data: [{ id: 't1' }], error: null });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    mockFrom.mockReturnValue({ select: selectFn });

    const { result } = renderHook(() => useBaselineTargets('bl-123'), { wrapper: createWrapper() });
    await flushQueries();

    expect(result.current.isSuccess).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('baseline_targets');
    expect(eqFn).toHaveBeenCalledWith('baseline_id', 'bl-123');
  });
});
