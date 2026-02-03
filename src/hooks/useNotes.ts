import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TimelineEvent, EventCategory, EventSource, RelatedAccount } from '@/types/operator';

/**
 * Hook to fetch ONLY true notes/flags for a client.
 * 
 * STRICT RULES (non-negotiable):
 * - Notes must have category = 'Note' 
 * - Notes must NOT have event_kind in ('action', 'response', 'outcome', 'draft')
 * - Notes must NOT be drafts (is_draft = false)
 * 
 * This ensures notes NEVER appear in Evidence Timeline or Drafts panel.
 * If event_kind = 'note' doesn't exist yet, this returns empty until proper notes are created.
 */
export function useNotes(clientId: string | undefined) {
  return useQuery({
    queryKey: ['notes', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      // Fetch only true notes - category='Note' with event_kind='note' (or equivalent)
      // Explicitly exclude action/response/outcome/draft kinds
      const { data, error } = await supabase
        .from('timeline_events')
        .select('*')
        .eq('client_id', clientId)
        .eq('category', 'Note')
        .eq('is_draft', false)
        .not('event_kind', 'in', '("action","response","outcome","draft")')
        .order('event_date', { ascending: false, nullsFirst: true })
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
