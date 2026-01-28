import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ActionCategory = 'Completed' | 'Response' | 'ToDo';
export type ActionStatus = 'Done' | 'Open';
export type ActionPriority = 'Low' | 'Medium' | 'High';

export interface CaseAction {
  id: string;
  case_id: string;
  category: ActionCategory;
  title: string;
  event_date: string;
  due_date: string | null;
  status: ActionStatus;
  priority: ActionPriority | null;
  details: string | null;
  related_entity: string | null;
  related_account: string | null;
  related_account_masked: string | null;
  created_at: string;
  updated_at: string;
}

export function useCaseActions(caseId: string | undefined) {
  return useQuery({
    queryKey: ['case-actions', caseId],
    queryFn: async () => {
      if (!caseId) return [];

      const { data, error } = await supabase
        .from('case_actions')
        .select('*')
        .eq('case_id', caseId)
        .order('event_date', { ascending: false });

      if (error) throw error;
      return data as CaseAction[];
    },
    enabled: !!caseId,
  });
}

export function useCompletedActions(caseId: string | undefined) {
  return useQuery({
    queryKey: ['case-actions-completed', caseId],
    queryFn: async () => {
      if (!caseId) return [];

      const { data, error } = await supabase
        .from('case_actions')
        .select('*')
        .eq('case_id', caseId)
        .eq('category', 'Completed')
        .order('event_date', { ascending: false });

      if (error) throw error;
      return data as CaseAction[];
    },
    enabled: !!caseId,
  });
}

export function useResponseActions(caseId: string | undefined) {
  return useQuery({
    queryKey: ['case-actions-responses', caseId],
    queryFn: async () => {
      if (!caseId) return [];

      const { data, error } = await supabase
        .from('case_actions')
        .select('*')
        .eq('case_id', caseId)
        .eq('category', 'Response')
        .order('event_date', { ascending: false });

      if (error) throw error;
      return data as CaseAction[];
    },
    enabled: !!caseId,
  });
}

export function useToDoActions(caseId: string | undefined) {
  return useQuery({
    queryKey: ['case-actions-todos', caseId],
    queryFn: async () => {
      if (!caseId) return [];

      const { data, error } = await supabase
        .from('case_actions')
        .select('*')
        .eq('case_id', caseId)
        .eq('category', 'ToDo')
        .eq('status', 'Open')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as CaseAction[];
    },
    enabled: !!caseId,
  });
}

export function useAddCaseAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: Omit<CaseAction, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('case_actions')
        .insert(action)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['case-actions', variables.case_id] });
      queryClient.invalidateQueries({ queryKey: ['case-actions-completed', variables.case_id] });
      queryClient.invalidateQueries({ queryKey: ['case-actions-responses', variables.case_id] });
      queryClient.invalidateQueries({ queryKey: ['case-actions-todos', variables.case_id] });
      toast.success('Entry added');
    },
    onError: (error) => {
      toast.error('Failed to add entry');
      console.error(error);
    },
  });
}

export function useUpdateCaseAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, caseId, ...updates }: Partial<CaseAction> & { id: string; caseId: string }) => {
      const { data, error } = await supabase
        .from('case_actions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, caseId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['case-actions', data.caseId] });
      queryClient.invalidateQueries({ queryKey: ['case-actions-completed', data.caseId] });
      queryClient.invalidateQueries({ queryKey: ['case-actions-responses', data.caseId] });
      queryClient.invalidateQueries({ queryKey: ['case-actions-todos', data.caseId] });
      toast.success('Entry updated');
    },
    onError: (error) => {
      toast.error('Failed to update entry');
      console.error(error);
    },
  });
}
