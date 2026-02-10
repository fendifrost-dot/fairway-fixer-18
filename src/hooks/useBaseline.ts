import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// ── Types ──────────────────────────────────────────────────────────────

export interface BaselineAnalysis {
  id: string;
  client_id: string;
  source_type: string;
  original_text: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BaselineTarget {
  id: string;
  baseline_id: string;
  bureau: 'Experian' | 'TransUnion' | 'Equifax';
  item_type: string;
  label: string;
  fingerprint: string;
  raw_fields: Record<string, any>;
  status: 'pending' | 'still_present' | 'not_found';
  created_at: string;
  updated_at: string;
}

export interface CommitBaselineInput {
  sourceType: string;
  originalText: string;
  targets: Array<{
    bureau: string;
    item_type: string;
    label: string;
    fingerprint: string;
    raw_fields?: Record<string, any>;
    status?: 'pending' | 'still_present' | 'not_found';
  }>;
}

// ── Hooks ──────────────────────────────────────────────────────────────

export function useBaseline(clientId: string) {
  const queryClient = useQueryClient();

  const activeBaseline = useQuery({
    queryKey: ['baseline', clientId, 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baseline_analyses')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as BaselineAnalysis | null;
    },
    enabled: !!clientId,
  });

  const history = useQuery({
    queryKey: ['baseline', clientId, 'history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baseline_analyses')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as BaselineAnalysis[];
    },
    enabled: !!clientId,
  });

  const commitBaseline = useMutation({
    mutationFn: async (input: CommitBaselineInput) => {
      // Pre-dedupe targets by fingerprint (keep first occurrence)
      const seen = new Set<string>();
      const dedupedTargets: Json[] = [];
      for (const t of input.targets) {
        if (seen.has(t.fingerprint)) continue;
        seen.add(t.fingerprint);
        dedupedTargets.push({
          bureau: t.bureau,
          item_type: t.item_type,
          label: t.label,
          fingerprint: t.fingerprint,
          raw_fields: (t.raw_fields ?? {}) as Json,
          status: t.status ?? 'pending',
        });
      }

      if (!clientId) throw new Error('clientId is required');

      const { data, error } = await supabase.rpc('commit_baseline', {
        _client_id: clientId,
        _source_type: input.sourceType,
        _original_text: input.originalText,
        _targets: dedupedTargets as Json,
      });

      if (error) throw error;

      // RPC returns jsonb: { baseline_id, targets_inserted }
      const result = data as unknown as { baseline_id: string; targets_inserted: number };
      return result.baseline_id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baseline', clientId], exact: false });
      queryClient.invalidateQueries({ queryKey: ['baseline_targets'], exact: false });
    },
  });

  return { activeBaseline, history, commitBaseline };
}

export function useBaselineTargets(baselineId?: string) {
  return useQuery({
    queryKey: ['baseline_targets', baselineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baseline_targets')
        .select('*')
        .eq('baseline_id', baselineId!);

      if (error) throw error;
      return (data ?? []) as BaselineTarget[];
    },
    enabled: !!baselineId,
  });
}
