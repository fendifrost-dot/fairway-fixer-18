import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TimelineEvent, EventCategory, EventSource, RelatedAccount } from '@/types/operator';

/**
 * Hook to fetch draft documents for a client.
 * 
 * Drafts are rows where: is_draft = true OR event_kind = 'draft'
 * These are work-in-progress documents NOT YET SENT.
 */
export function useDrafts(clientId: string | undefined) {
  return useQuery({
    queryKey: ['drafts', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      // Fetch all draft rows for this client
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*')
        .eq('client_id', clientId)
        .or('is_draft.eq.true,event_kind.eq.draft')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(row => ({
        ...row,
        category: row.category as EventCategory,
        source: row.source as EventSource | null,
        related_accounts: (row.related_accounts as unknown) as RelatedAccount[] | null,
        is_draft: row.is_draft,
        event_kind: row.event_kind,
      })) as TimelineEvent[];
    },
    enabled: !!clientId,
  });
}
