/**
 * Tradelines hook (B5)
 *
 * - useTradelines: list query for one client.
 * - useTradelineBureauStates: per-tradeline pivot rows (3 bureaus).
 * - useCreateTradeline / useUpdateTradeline: manual CRUD.
 * - useUpsertBureauState: write a per-bureau pivot row.
 * - ensureTradeline: parser-side find-or-create helper, mirrors ensureFurnisher.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  Tradeline,
  TradelineBureau,
  TradelineBureauState,
  TradelineStatus,
} from '@/types/operator';
import { toast } from 'sonner';

// Cast helper: tradelines tables are not yet in the generated supabase types.
// We use untyped `from` to keep this file isolated from the regenerated file.
const tbl = (name: string) => (supabase as any).from(name);

export function useTradelines(clientId: string | undefined) {
  return useQuery({
    queryKey: ['tradelines', clientId],
    queryFn: async () => {
      if (!clientId) return [] as Tradeline[];
      const { data, error } = await tbl('tradelines')
        .select('*')
        .eq('client_id', clientId)
        .order('display_name', { ascending: true });
      if (error) throw error;
      return (data || []) as Tradeline[];
    },
    enabled: !!clientId,
  });
}

export function useTradelineBureauStates(clientId: string | undefined) {
  // Fetch all bureau states for the client by joining via tradelines.
  return useQuery({
    queryKey: ['tradeline-bureau-states', clientId],
    queryFn: async () => {
      if (!clientId) return [] as TradelineBureauState[];
      const { data: tls, error: e1 } = await tbl('tradelines')
        .select('id')
        .eq('client_id', clientId);
      if (e1) throw e1;
      const ids = ((tls || []) as { id: string }[]).map(r => r.id);
      if (ids.length === 0) return [] as TradelineBureauState[];
      const { data, error } = await tbl('tradeline_bureau_states')
        .select('*')
        .in('tradeline_id', ids);
      if (error) throw error;
      return (data || []) as TradelineBureauState[];
    },
    enabled: !!clientId,
  });
}

export function useCreateTradeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      display_name: string;
      account_last4?: string | null;
      balance?: number | null;
      opened_date?: string | null;
      furnisher_id?: string | null;
      status?: TradelineStatus;
      notes?: string | null;
    }) => {
      const { data, error } = await tbl('tradelines')
        .insert({
          client_id: input.client_id,
          display_name: input.display_name.trim(),
          account_last4: input.account_last4 ?? null,
          balance: input.balance ?? null,
          opened_date: input.opened_date ?? null,
          furnisher_id: input.furnisher_id ?? null,
          status: input.status ?? 'unknown',
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Tradeline;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['tradelines', t.client_id] });
      qc.invalidateQueries({ queryKey: ['tradeline-bureau-states', t.client_id] });
    },
    onError: (e: Error) => toast.error('Failed to create tradeline: ' + e.message),
  });
}

export function useUpdateTradeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      clientId,
      updates,
    }: {
      id: string;
      clientId: string;
      updates: Partial<Pick<Tradeline,
        'display_name' | 'account_last4' | 'balance' | 'opened_date' | 'furnisher_id' | 'status' | 'notes'>>;
    }) => {
      const { error } = await tbl('tradelines').update(updates).eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      qc.invalidateQueries({ queryKey: ['tradelines', clientId] });
    },
    onError: (e: Error) => toast.error('Failed to update tradeline: ' + e.message),
  });
}

export function useDeleteTradeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await tbl('tradelines').delete().eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      qc.invalidateQueries({ queryKey: ['tradelines', clientId] });
      qc.invalidateQueries({ queryKey: ['tradeline-bureau-states', clientId] });
    },
    onError: (e: Error) => toast.error('Failed to delete tradeline: ' + e.message),
  });
}

export function useUpsertBureauState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      tradeline_id: string;
      bureau: TradelineBureau;
      present: boolean;
      status_on_bureau?: string | null;
      last_seen_date?: string | null;
      notes?: string | null;
    }) => {
      const payload = {
        tradeline_id: input.tradeline_id,
        bureau: input.bureau,
        present: input.present,
        status_on_bureau: input.status_on_bureau ?? null,
        last_seen_date: input.last_seen_date ?? null,
        notes: input.notes ?? null,
      };
      const { error } = await tbl('tradeline_bureau_states')
        .upsert(payload, { onConflict: 'tradeline_id,bureau' });
      if (error) throw error;
      return input.client_id;
    },
    onSuccess: (clientId) => {
      qc.invalidateQueries({ queryKey: ['tradeline-bureau-states', clientId] });
    },
    onError: (e: Error) => toast.error('Failed to update bureau state: ' + e.message),
  });
}

/**
 * Find an existing tradeline by (client_id, lower(display_name), account_last4)
 * or create one. Used by parser/import to attach events.
 *
 * Mirrors ensureFurnisher's match rules:
 *  - If account_last4 is provided, match exact (lower(name), last4); else
 *    upgrade an existing name-only row to set last4.
 *  - If account_last4 is null, match any tradeline with same name and no last4;
 *    create one if none exists.
 */
export async function ensureTradeline(
  clientId: string,
  displayName: string,
  accountLast4: string | null = null
): Promise<Tradeline> {
  const trimmed = displayName.trim();
  if (!trimmed) throw new Error('Tradeline display_name is required');

  if (accountLast4) {
    const { data: exact, error: e1 } = await tbl('tradelines')
      .select('*')
      .eq('client_id', clientId)
      .ilike('display_name', trimmed)
      .eq('account_last4', accountLast4)
      .maybeSingle();
    if (e1 && e1.code !== 'PGRST116') throw e1;
    if (exact) return exact as Tradeline;

    const { data: noLast4, error: e2 } = await tbl('tradelines')
      .select('*')
      .eq('client_id', clientId)
      .ilike('display_name', trimmed)
      .is('account_last4', null)
      .maybeSingle();
    if (e2 && e2.code !== 'PGRST116') throw e2;
    if (noLast4) {
      const { data: upgraded, error: e3 } = await tbl('tradelines')
        .update({ account_last4: accountLast4 })
        .eq('id', (noLast4 as { id: string }).id)
        .select()
        .single();
      if (e3) throw e3;
      return upgraded as Tradeline;
    }
  } else {
    const { data: existing, error: eS } = await tbl('tradelines')
      .select('*')
      .eq('client_id', clientId)
      .ilike('display_name', trimmed)
      .is('account_last4', null)
      .maybeSingle();
    if (eS && eS.code !== 'PGRST116') throw eS;
    if (existing) return existing as Tradeline;
  }

  const { data: created, error: eIns } = await tbl('tradelines')
    .insert({ client_id: clientId, display_name: trimmed, account_last4: accountLast4 })
    .select()
    .single();
  if (eIns) throw eIns;
  return created as Tradeline;
}