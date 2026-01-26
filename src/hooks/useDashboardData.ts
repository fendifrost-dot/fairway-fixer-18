import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  DbClient, DbMatter, DbTask, DbDeadline, DbViolation, 
  DashboardFilters, MatterState, DbEntityCase 
} from '@/types/database';
import { addDays, startOfDay, endOfDay, isAfter, isBefore } from 'date-fns';

// Fetch all clients for the current user
export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('legal_name');
      
      if (error) throw error;
      return data as DbClient[];
    },
  });
}

// Fetch matters with optional filters
export function useMatters(filters?: Partial<DashboardFilters>) {
  return useQuery({
    queryKey: ['matters', filters],
    queryFn: async () => {
      let query = supabase
        .from('matters')
        .select(`
          *,
          client:clients(*)
        `)
        .order('updated_at', { ascending: false });

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }

      if (filters?.matterType && filters.matterType !== 'all') {
        query = query.eq('matter_type', filters.matterType);
      }

      if (filters?.states && filters.states.length > 0) {
        query = query.in('primary_state', filters.states);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DbMatter[];
    },
  });
}

// Fetch tasks with filters and joins
export function useTasks(filters?: Partial<DashboardFilters>) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          matter:matters(*, client:clients(*)),
          entity_case:entity_cases(*)
        `)
        .neq('status', 'Done')
        .order('due_date', { ascending: true, nullsFirst: false });

      const { data, error } = await query;
      if (error) throw error;

      let tasks = data as DbTask[];

      // Apply time window filter
      if (filters?.timeWindow) {
        const now = new Date();
        const today = startOfDay(now);
        const todayEnd = endOfDay(now);
        
        tasks = tasks.filter(task => {
          if (!task.due_date) return filters.timeWindow === 'overdue' ? false : true;
          const dueDate = new Date(task.due_date);
          
          switch (filters.timeWindow) {
            case 'today':
              return dueDate <= todayEnd;
            case 'week':
              return dueDate <= addDays(today, 7);
            case 'month':
              return dueDate <= addDays(today, 30);
            case 'overdue':
              return isBefore(dueDate, today);
            default:
              return true;
          }
        });
      }

      // Apply client filter
      if (filters?.clientId) {
        tasks = tasks.filter(task => task.matter?.client_id === filters.clientId);
      }

      // Apply matter type filter
      if (filters?.matterType && filters.matterType !== 'all') {
        tasks = tasks.filter(task => task.matter?.matter_type === filters.matterType);
      }

      // Apply state filter
      if (filters?.states && filters.states.length > 0) {
        tasks = tasks.filter(task => 
          task.matter && filters.states!.includes(task.matter.primary_state)
        );
      }

      return tasks;
    },
  });
}

// Fetch deadlines with filters
export function useDeadlines(filters?: Partial<DashboardFilters>) {
  return useQuery({
    queryKey: ['deadlines', filters],
    queryFn: async () => {
      let query = supabase
        .from('deadlines')
        .select(`
          *,
          matter:matters(*, client:clients(*)),
          entity_case:entity_cases(*)
        `)
        .neq('status', 'Closed')
        .order('due_date', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      let deadlines = data as DbDeadline[];

      // Apply time window filter
      if (filters?.timeWindow) {
        const now = new Date();
        const today = startOfDay(now);
        const todayEnd = endOfDay(now);
        
        deadlines = deadlines.filter(deadline => {
          const dueDate = new Date(deadline.due_date);
          
          switch (filters.timeWindow) {
            case 'today':
              return dueDate <= todayEnd;
            case 'week':
              return dueDate <= addDays(today, 7);
            case 'month':
              return dueDate <= addDays(today, 30);
            case 'overdue':
              return isBefore(dueDate, today);
            default:
              return true;
          }
        });
      }

      // Apply client filter
      if (filters?.clientId) {
        deadlines = deadlines.filter(d => d.matter?.client_id === filters.clientId);
      }

      // Apply matter type filter
      if (filters?.matterType && filters.matterType !== 'all') {
        deadlines = deadlines.filter(d => d.matter?.matter_type === filters.matterType);
      }

      // Apply state filter
      if (filters?.states && filters.states.length > 0) {
        deadlines = deadlines.filter(d => 
          d.matter && filters.states!.includes(d.matter.primary_state)
        );
      }

      return deadlines;
    },
  });
}

// Fetch violations
export function useViolations(filters?: Partial<DashboardFilters>) {
  return useQuery({
    queryKey: ['violations', filters],
    queryFn: async () => {
      let query = supabase
        .from('violations')
        .select(`
          *,
          matter:matters(*, client:clients(*)),
          entity_case:entity_cases(*)
        `)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      let violations = data as DbViolation[];

      if (filters?.clientId) {
        violations = violations.filter(v => v.matter?.client_id === filters.clientId);
      }

      if (filters?.matterType && filters.matterType !== 'all') {
        violations = violations.filter(v => v.matter?.matter_type === filters.matterType);
      }

      if (filters?.states && filters.states.length > 0) {
        violations = violations.filter(v => 
          v.matter && filters.states!.includes(v.matter.primary_state)
        );
      }

      return violations;
    },
  });
}

// State counts for pressure strip
export function useStateCounts(filters?: Partial<DashboardFilters>) {
  return useQuery({
    queryKey: ['stateCounts', filters],
    queryFn: async () => {
      let query = supabase
        .from('matters')
        .select('primary_state, client_id, matter_type');

      const { data, error } = await query;
      if (error) throw error;

      let matters = data as { primary_state: MatterState; client_id: string; matter_type: string }[];

      // Apply filters
      if (filters?.clientId) {
        matters = matters.filter(m => m.client_id === filters.clientId);
      }
      if (filters?.matterType && filters.matterType !== 'all') {
        matters = matters.filter(m => m.matter_type === filters.matterType);
      }

      // Count by state
      const counts: Record<MatterState, number> = {
        Intake: 0,
        DisputePreparation: 0,
        DisputeActive: 0,
        PartialCompliance: 0,
        ViolationConfirmed: 0,
        ReinsertionDetected: 0,
        RegulatoryReview: 0,
        Blocked: 0,
        FurnisherLiabilityTrack: 0,
        EscalationEligible: 0,
        LitigationReady: 0,
        Resolved: 0,
      };

      matters.forEach(m => {
        counts[m.primary_state]++;
      });

      return counts;
    },
  });
}

// Reinsertion matters for alert panel
export function useReinsertionMatters() {
  return useQuery({
    queryKey: ['reinsertionMatters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matters')
        .select(`
          *,
          client:clients(*),
          violations:violations(*)
        `)
        .eq('primary_state', 'ReinsertionDetected')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

// Entity cases for a matter
export function useEntityCases(matterId?: string) {
  return useQuery({
    queryKey: ['entityCases', matterId],
    queryFn: async () => {
      if (!matterId) return [];
      
      const { data, error } = await supabase
        .from('entity_cases')
        .select('*')
        .eq('matter_id', matterId)
        .order('entity_type', { ascending: true });

      if (error) throw error;
      return data as DbEntityCase[];
    },
    enabled: !!matterId,
  });
}
