import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OperatorTask, SimplePriority, SimpleStatus } from '@/types/operator';
import { toast } from 'sonner';

export function useOperatorTasks(clientId: string | undefined) {
  return useQuery({
    queryKey: ['operator-tasks', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('operator_tasks')
        .select('*')
        .eq('client_id', clientId)
        .order('status', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      
      return (data || []).map(row => ({
        ...row,
        priority: row.priority as SimplePriority,
        status: row.status as SimpleStatus,
      })) as OperatorTask[];
    },
    enabled: !!clientId,
  });
}

export function useCreateOperatorTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (task: Omit<OperatorTask, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('operator_tasks')
        .insert({
          client_id: task.client_id,
          title: task.title,
          due_date: task.due_date,
          priority: task.priority,
          status: task.status,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['operator-tasks', variables.client_id] });
      toast.success('Task created');
    },
    onError: (error) => {
      toast.error('Failed to create task: ' + error.message);
    },
  });
}

export function useBulkCreateOperatorTasks() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (tasks: Omit<OperatorTask, 'id' | 'created_at'>[]) => {
      if (tasks.length === 0) return [];
      
      const { data, error } = await supabase
        .from('operator_tasks')
        .insert(tasks.map(t => ({
          client_id: t.client_id,
          title: t.title,
          due_date: t.due_date,
          priority: t.priority,
          status: t.status,
        })))
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['operator-tasks', variables[0].client_id] });
      }
    },
    onError: (error) => {
      toast.error('Failed to import tasks: ' + error.message);
    },
  });
}

export function useUpdateOperatorTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, clientId, updates }: { 
      id: string; 
      clientId: string;
      updates: Partial<Pick<OperatorTask, 'title' | 'due_date' | 'priority' | 'status'>> 
    }) => {
      const { data, error } = await supabase
        .from('operator_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { data, clientId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['operator-tasks', result.clientId] });
    },
    onError: (error) => {
      toast.error('Failed to update task: ' + error.message);
    },
  });
}

export function useDeleteOperatorTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase
        .from('operator_tasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { clientId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['operator-tasks', result.clientId] });
      toast.success('Task deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete task: ' + error.message);
    },
  });
}
