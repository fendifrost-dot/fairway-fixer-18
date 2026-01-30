import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TimelineEvent, EventCategory, EventSource, RelatedAccount } from '@/types/operator';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export function useTimelineEvents(clientId: string | undefined) {
  return useQuery({
    queryKey: ['timeline-events', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*')
        .eq('client_id', clientId)
        .order('event_date', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(row => ({
        ...row,
        category: row.category as EventCategory,
        source: row.source as EventSource | null,
        related_accounts: (row.related_accounts as unknown) as RelatedAccount[] | null,
      })) as TimelineEvent[];
    },
    enabled: !!clientId,
  });
}

export function useCreateTimelineEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (event: Omit<TimelineEvent, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('timeline_events')
        .insert({
          client_id: event.client_id,
          event_date: event.event_date,
          category: event.category,
          source: event.source,
          title: event.title,
          summary: event.summary,
          details: event.details,
          related_accounts: event.related_accounts as unknown as Json,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['timeline-events', variables.client_id] });
    },
    onError: (error) => {
      toast.error('Failed to create event: ' + error.message);
    },
  });
}

export function useBulkCreateTimelineEvents() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (events: Omit<TimelineEvent, 'id' | 'created_at'>[]) => {
      if (events.length === 0) return [];
      
      const { data, error } = await supabase
        .from('timeline_events')
        .insert(events.map(e => ({
          client_id: e.client_id,
          event_date: e.event_date,
          category: e.category,
          source: e.source,
          title: e.title,
          summary: e.summary,
          details: e.details,
          related_accounts: e.related_accounts as unknown as Json,
        })))
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['timeline-events', variables[0].client_id] });
      }
    },
    onError: (error) => {
      toast.error('Failed to import events: ' + error.message);
    },
  });
}

export function useDeleteTimelineEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from('timeline_events')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { clientId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['timeline-events', result.clientId] });
      toast.success('Event deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete event: ' + error.message);
    },
  });
}
