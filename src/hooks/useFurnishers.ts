/**
 * Furnishers hook (B4)
 *
 * Mirrors the shape of useDisputeRounds — list query, create/update mutations,
 * and a parser-side `ensureFurnisher` find-or-create helper.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Furnisher } from '@/types/operator';
import { toast } from 'sonner';

export function useFurnishers(clientId: string | undefined) {
  return useQuery({
    queryKey: ['furnishers', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('furnishers')
        .select('*')
        .eq('client_id', clientId)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Furnisher[];
    },
    enabled: !!clientId,
  });
}

export function useCreateFurnisher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      name: string;
      account_last4?: string | null;
      account_type?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('furnishers')
        .insert({
          client_id: input.client_id,
          name: input.name.trim(),
          account_last4: input.account_last4 ?? null,
          account_type: input.account_type ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Furnisher;
    },
    onSuccess: (f) => qc.invalidateQueries({ queryKey: ['furnishers', f.client_id] }),
    onError: (e: Error) => toast.error('Failed to create furnisher: ' + e.message),
  });
}

export function useUpdateFurnisher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      clientId,
      updates,
    }: {
      id: string;
      clientId: string;
      updates: Partial<Pick<Furnisher, 'name' | 'account_last4' | 'account_type' | 'notes'>>;
    }) => {
      const { error } = await supabase.from('furnishers').update(updates).eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => qc.invalidateQueries({ queryKey: ['furnishers', clientId] }),
    onError: (e: Error) => toast.error('Failed to update furnisher: ' + e.message),
  });
}

/**
 * Find an existing furnisher by (client_id, lower(name), account_last4) or
 * create one. Used by the parser/import path to attach events to furnishers.
 *
 * Match rules mirror the DB unique indexes:
 *   - If account_last4 is provided, match exact (lower(name), account_last4).
 *   - If account_last4 is null, match any furnisher with the same name AND
 *     no account_last4 set; if none exists we create one with null last4.
 *
 * If the furnisher exists with a NULL last4 and we now know the last4, we
 * UPGRADE it (set account_last4) instead of creating a duplicate row.
 */
export async function ensureFurnisher(
  clientId: string,
  name: string,
  accountLast4: string | null
): Promise<Furnisher> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Furnisher name is required');

  // 1) Exact match by (name, last4) when last4 known
  if (accountLast4) {
    const { data: exact, error: exactErr } = await supabase
      .from('furnishers')
      .select('*')
      .eq('client_id', clientId)
      .ilike('name', trimmed)
      .eq('account_last4', accountLast4)
      .maybeSingle();
    if (exactErr && exactErr.code !== 'PGRST116') throw exactErr;
    if (exact) return exact as unknown as Furnisher;

    // 2) Upgrade path: same name with NULL last4 → set last4
    const { data: noLast4, error: noLast4Err } = await supabase
      .from('furnishers')
      .select('*')
      .eq('client_id', clientId)
      .ilike('name', trimmed)
      .is('account_last4', null)
      .maybeSingle();
    if (noLast4Err && noLast4Err.code !== 'PGRST116') throw noLast4Err;
    if (noLast4) {
      const { data: upgraded, error: upErr } = await supabase
        .from('furnishers')
        .update({ account_last4: accountLast4 })
        .eq('id', (noLast4 as { id: string }).id)
        .select()
        .single();
      if (upErr) throw upErr;
      return upgraded as unknown as Furnisher;
    }
  } else {
    // No last4 known: try to match the name-only row first
    const { data: existing, error: selErr } = await supabase
      .from('furnishers')
      .select('*')
      .eq('client_id', clientId)
      .ilike('name', trimmed)
      .is('account_last4', null)
      .maybeSingle();
    if (selErr && selErr.code !== 'PGRST116') throw selErr;
    if (existing) return existing as unknown as Furnisher;
  }

  // 3) Create
  const { data: created, error: insErr } = await supabase
    .from('furnishers')
    .insert({ client_id: clientId, name: trimmed, account_last4: accountLast4 })
    .select()
    .single();
  if (insErr) throw insErr;
  return created as unknown as Furnisher;
}