/**
 * Hook for managing source corrections (drag-and-drop audit trail)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EventSource } from '@/types/operator';

interface CreateCorrectionParams {
  eventId: string;
  fromSource: string;
  toSource: EventSource;
  clientId: string;
  notes?: string;
  method?: 'drag' | 'manual';
}

export function useCreateSourceCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, fromSource, toSource, clientId, notes, method = 'drag' }: CreateCorrectionParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // First update the timeline event source (DB uses PascalCase for event_source enum)
      const { error: updateError } = await supabase
        .from('timeline_events')
        .update({ source: toSource })
        .eq('id', eventId);

      if (updateError) throw updateError;

      // Normalize sources to lowercase for source_corrections table constraint
      // The constraint expects: experian, transunion, equifax, etc. (lowercase)
      const fromSourceLower = fromSource?.toLowerCase() || 'other';
      const toSourceLower = toSource.toLowerCase();

      // Then log the correction
      const { data, error: insertError } = await supabase
        .from('source_corrections')
        .insert({
          event_id: eventId,
          from_source: fromSourceLower,
          to_source: toSourceLower,
          corrected_by: user.id,
          notes: notes || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return { correction: data, clientId, fromSource, toSource, method };
    },
    onSuccess: ({ clientId, fromSource, toSource, method }) => {
      queryClient.invalidateQueries({ queryKey: ['timeline-events', clientId] });

      const suffix = method === 'manual' ? ' (manual correction)' : '';
      toast.success(`Source updated: ${fromSource} → ${toSource}${suffix}`);
    },
    onError: (error) => {
      toast.error('Failed to correct source: ' + error.message);
    },
  });
}
