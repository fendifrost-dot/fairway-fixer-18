/**
 * Diagnostic signals hooks (C1+).
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { DiagnosticSignal } from '@/types/operator';
import { detectFurnisherRenames } from '@/lib/diagnostics/furnisherRenames';
import { detectPostRoundNewHarm } from '@/lib/diagnostics/postRoundNewHarm';
import { detectAutomatedReverification } from '@/lib/diagnostics/automatedReverification';
import { useTradelines, useTradelineBureauStates } from '@/hooks/useTradelines';
import { useDisputeRounds } from '@/hooks/useDisputeRounds';
import { useTimelineEvents } from '@/hooks/useTimelineEvents';

const tbl = (name: string) => (supabase as any).from(name);

export function useDiagnosticSignals(clientId: string | undefined) {
  return useQuery({
    queryKey: ['diagnostic-signals', clientId],
    queryFn: async () => {
      if (!clientId) return [] as DiagnosticSignal[];
      const { data, error } = await tbl('diagnostic_signals')
        .select('*')
        .eq('client_id', clientId)
        .order('detected_at', { ascending: false });
      if (error) throw error;
      return (data || []) as DiagnosticSignal[];
    },
    enabled: !!clientId,
  });
}

export function useDismissDiagnosticSignal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await tbl('diagnostic_signals')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      qc.invalidateQueries({ queryKey: ['diagnostic-signals', clientId] });
      toast.success('Signal dismissed');
    },
    onError: (e: Error) => toast.error('Failed to dismiss: ' + e.message),
  });
}

/**
 * Auto-runs the furnisher-rename detector when tradelines/bureau states change
 * for the given client. Cheap upsert; the unique constraint dedupes.
 */
export function useAutoDetectFurnisherRenames(clientId: string | undefined) {
  const qc = useQueryClient();
  const { data: tradelines } = useTradelines(clientId);
  const { data: states } = useTradelineBureauStates(clientId);

  // Re-run when the count or fingerprint of tradelines/states changes.
  const fingerprint = JSON.stringify({
    t: (tradelines || []).map(t => [t.id, t.display_name, t.account_last4, t.opened_date, t.balance, t.furnisher_id]),
    s: (states || []).map(s => [s.tradeline_id, s.bureau, s.present]),
  });

  useEffect(() => {
    if (!clientId) return;
    if (!tradelines || !states) return;
    if (tradelines.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const n = await detectFurnisherRenames(clientId);
        if (!cancelled && n > 0) {
          qc.invalidateQueries({ queryKey: ['diagnostic-signals', clientId] });
        }
      } catch (e) {
        // Non-fatal — diagnostics are best-effort.
        console.warn('[diagnostics] furnisher-rename detection failed', e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, fingerprint]);
}

/**
 * C2 — Auto-runs the post-round new-harm detector when rounds, tradelines,
 * bureau states, or timeline events change.
 */
export function useAutoDetectPostRoundNewHarm(clientId: string | undefined) {
  const qc = useQueryClient();
  const { data: tradelines } = useTradelines(clientId);
  const { data: states } = useTradelineBureauStates(clientId);
  const { data: rounds } = useDisputeRounds(clientId);
  const { data: events } = useTimelineEvents(clientId);

  const fingerprint = JSON.stringify({
    r: (rounds || []).map(r => [r.id, r.submitted_at, r.round_number]),
    t: (tradelines || []).map(t => [t.id, t.created_at, t.opened_date, t.status, t.display_name]),
    s: (states || []).map(s => [s.tradeline_id, s.bureau, s.status_on_bureau]),
    e: (events || []).filter(e => e.event_kind === 'action').map(e => [e.id, e.round_id, e.tradeline_id]),
  });

  useEffect(() => {
    if (!clientId) return;
    if (!tradelines || !states || !rounds || !events) return;
    if (rounds.length === 0 || tradelines.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const n = await detectPostRoundNewHarm(clientId);
        if (!cancelled && n > 0) {
          qc.invalidateQueries({ queryKey: ['diagnostic-signals', clientId] });
        }
      } catch (e) {
        console.warn('[diagnostics] post-round new-harm detection failed', e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, fingerprint]);
}

/**
 * C3 — Auto-runs the automated-reverification detector when timeline events change.
 */
export function useAutoDetectAutomatedReverification(clientId: string | undefined) {
  const qc = useQueryClient();
  const { data: events } = useTimelineEvents(clientId);

  const fingerprint = JSON.stringify(
    (events || []).map(e => [
      e.id, e.category, e.source, e.event_date, e.title?.length || 0,
      (e.summary || '').length, (e.details || '').length, e.tradeline_id,
    ])
  );

  useEffect(() => {
    if (!clientId) return;
    if (!events) return;
    if (events.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const n = await detectAutomatedReverification(clientId);
        if (!cancelled && n > 0) {
          qc.invalidateQueries({ queryKey: ['diagnostic-signals', clientId] });
        }
      } catch (e) {
        console.warn('[diagnostics] automated-reverification detection failed', e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, fingerprint]);
}