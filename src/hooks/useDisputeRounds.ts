import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DisputeRound, DisputeRoundStatus } from '@/types/operator';
import { toast } from 'sonner';

export function useDisputeRounds(clientId: string | undefined) {
  return useQuery({
    queryKey: ['dispute-rounds', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('dispute_rounds')
        .select('*')
        .eq('client_id', clientId)
        .order('round_number', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as DisputeRound[];
    },
    enabled: !!clientId,
  });
}

export function useCreateDisputeRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      round_number: number;
      status?: DisputeRoundStatus;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('dispute_rounds')
        .insert({
          client_id: input.client_id,
          round_number: input.round_number,
          status: input.status ?? 'planning',
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as DisputeRound;
    },
    onSuccess: (round) => {
      qc.invalidateQueries({ queryKey: ['dispute-rounds', round.client_id] });
    },
    onError: (e: Error) => toast.error('Failed to create round: ' + e.message),
  });
}

export function useUpdateDisputeRound() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      clientId,
      updates,
    }: {
      id: string;
      clientId: string;
      updates: Partial<Pick<DisputeRound, 'status' | 'notes' | 'submitted_at' | 'completed_at'>>;
    }) => {
      const { error } = await supabase
        .from('dispute_rounds')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      qc.invalidateQueries({ queryKey: ['dispute-rounds', clientId] });
    },
    onError: (e: Error) => toast.error('Failed to update round: ' + e.message),
  });
}

/**
 * Find an existing round by (client_id, round_number) or create one.
 * Used by parser/import path to attach events to rounds via [Round N] tags.
 */
export async function ensureRound(
  clientId: string,
  roundNumber: number
): Promise<DisputeRound> {
  const { data: existing, error: selErr } = await supabase
    .from('dispute_rounds')
    .select('*')
    .eq('client_id', clientId)
    .eq('round_number', roundNumber)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing as unknown as DisputeRound;

  const { data: created, error: insErr } = await supabase
    .from('dispute_rounds')
    .insert({ client_id: clientId, round_number: roundNumber, status: 'planning' })
    .select()
    .single();
  if (insErr) throw insErr;
  return created as unknown as DisputeRound;
}