import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  GenerateDisputeLetterRequest,
  GenerateDisputeLetterResponse,
} from '@/lib/disputeLetters/types';

export function useGenerateDisputeLetter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: GenerateDisputeLetterRequest): Promise<GenerateDisputeLetterResponse> => {
      const t = toast.loading('Generating dispute letter…');
      try {
        const { data, error } = await supabase.functions.invoke('generate-dispute-letter', { body: req });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        toast.success(`Letter ready — ${(data as GenerateDisputeLetterResponse).summary}`, { id: t });
        return data as GenerateDisputeLetterResponse;
      } catch (e) {
        toast.error('Letter generation failed: ' + (e as Error).message, { id: t });
        throw e;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['timeline-events', vars.client_id] });
      qc.invalidateQueries({ queryKey: ['event-attachments', vars.client_id] });
      qc.invalidateQueries({ queryKey: ['dispute-rounds', vars.client_id] });
    },
  });
}
