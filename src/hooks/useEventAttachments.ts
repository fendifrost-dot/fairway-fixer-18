/**
 * useEventAttachments (B7)
 *
 * Loads + creates timeline_event_attachments rows for a given client.
 * Single query keyed by clientId so the EvidenceTimeline can hand attachments
 * down to each EvidenceItem without N round-trips.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TimelineEventAttachment } from '@/types/operator';
import { toast } from 'sonner';

export function useEventAttachments(clientId: string | undefined) {
  return useQuery({
    queryKey: ['event-attachments', clientId],
    queryFn: async () => {
      if (!clientId) return [] as TimelineEventAttachment[];
      // pull event ids belonging to this client first, then attachments for them
      const { data: events, error: e1 } = await supabase
        .from('timeline_events')
        .select('id')
        .eq('client_id', clientId);
      if (e1) throw e1;
      const ids = (events ?? []).map((e: { id: string }) => e.id);
      if (ids.length === 0) return [] as TimelineEventAttachment[];
      const { data, error } = await (supabase as any)
        .from('timeline_event_attachments')
        .select('*')
        .in('event_id', ids)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TimelineEventAttachment[];
    },
    enabled: !!clientId,
    staleTime: 30_000,
  });
}

export function useCreateEventAttachments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      clientId: string;
      eventId: string;
      items: Array<{
        drive_path: string;
        file_url: string | null;
        mime_type: string;
        file_name: string;
        size_bytes?: number | null;
      }>;
    }) => {
      if (params.items.length === 0) return [];
      const rows = params.items.map((it) => ({
        event_id: params.eventId,
        drive_path: it.drive_path,
        file_url: it.file_url,
        mime_type: it.mime_type,
        file_name: it.file_name,
        size_bytes: it.size_bytes ?? null,
      }));
      const { data, error } = await (supabase as any)
        .from('timeline_event_attachments')
        .insert(rows)
        .select('*');
      if (error) throw error;
      return data as TimelineEventAttachment[];
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['event-attachments', vars.clientId] });
    },
    onError: (e: Error) => toast.error('Failed to save attachments: ' + e.message),
  });
}

/**
 * Bulk insert attachments for many freshly-created events at once.
 * `byEventId` maps event_id → attachment input list.
 */
export async function persistAttachmentsForEvents(
  clientId: string,
  byEventId: Record<string, Array<{
    drive_path: string;
    file_url: string | null;
    mime_type: string;
    file_name: string;
    size_bytes?: number | null;
  }>>,
): Promise<{ inserted: number; errors: string[] }> {
  const rows: Array<Record<string, unknown>> = [];
  for (const [eventId, list] of Object.entries(byEventId)) {
    for (const it of list) {
      rows.push({
        event_id: eventId,
        drive_path: it.drive_path,
        file_url: it.file_url,
        mime_type: it.mime_type,
        file_name: it.file_name,
        size_bytes: it.size_bytes ?? null,
      });
    }
  }
  if (rows.length === 0) return { inserted: 0, errors: [] };
  const { error, data } = await (supabase as any)
    .from('timeline_event_attachments')
    .insert(rows)
    .select('id');
  if (error) return { inserted: 0, errors: [error.message] };
  return { inserted: data?.length ?? 0, errors: [] };
}