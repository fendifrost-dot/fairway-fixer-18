import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  MatterType, MatterState, EntityType, TaskPriority, 
  ResponseType, EvidenceType, DateConfidence,
  DEFAULT_CRA_ENTITIES, DeadlineType
} from '@/types/database';
import { addDays, addBusinessDays } from 'date-fns';

interface CreateClientInput {
  legal_name: string;
  preferred_name?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

interface CreateMatterInput {
  client_id: string;
  matter_type: MatterType;
  title: string;
  jurisdiction?: string;
  primary_state?: MatterState;
  identity_theft?: boolean;
  mixed_file?: boolean;
  include_innovis?: boolean;
  include_lexis?: boolean;
  include_corelogic?: boolean;
  include_sagestream?: boolean;
}

interface LogActionInput {
  matter_id: string;
  entity_case_id?: string;
  action_type: string;
  action_date?: string;
  delivered_date?: string;
  evidence_type?: EvidenceType;
  date_confidence?: DateConfidence;
  summary?: string;
}

interface LogResponseInput {
  matter_id: string;
  entity_case_id: string;
  response_type: ResponseType;
  received_date?: string;
  summary?: string;
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateClientInput) => {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...input,
          owner_id: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useCreateMatter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMatterInput) => {
      // Create matter
      const { data: matter, error: matterError } = await supabase
        .from('matters')
        .insert({
          client_id: input.client_id,
          matter_type: input.matter_type,
          title: input.title,
          jurisdiction: input.jurisdiction || 'Federal (FCRA)',
          primary_state: input.primary_state || 'Intake',
        })
        .select()
        .single();

      if (matterError) throw matterError;

      // Auto-create entity cases for credit matters
      if (input.matter_type === 'Credit' || input.matter_type === 'Both') {
        const entities = [...DEFAULT_CRA_ENTITIES];
        
        if (input.include_innovis) {
          entities.push({ entity_type: 'CRA' as EntityType, entity_name: 'Innovis' });
        }
        if (input.include_lexis) {
          entities.push({ entity_type: 'DataBroker' as EntityType, entity_name: 'LexisNexis' });
        }
        if (input.include_corelogic) {
          entities.push({ entity_type: 'DataBroker' as EntityType, entity_name: 'CoreLogic Teletrack' });
        }
        if (input.include_sagestream) {
          entities.push({ entity_type: 'DataBroker' as EntityType, entity_name: 'SageStream' });
        }

        const entityCases = entities.map(e => ({
          matter_id: matter.id,
          entity_type: e.entity_type,
          entity_name: e.entity_name,
          state: 'DisputePreparation' as MatterState,
        }));

        const { error: entityError } = await supabase
          .from('entity_cases')
          .insert(entityCases);

        if (entityError) throw entityError;
      }

      // Auto-create overlays
      if (input.identity_theft) {
        await supabase.from('overlays').insert({
          matter_id: matter.id,
          overlay_type: 'IdentityTheftDocumented',
          is_active: true,
        });
      }
      if (input.mixed_file) {
        await supabase.from('overlays').insert({
          matter_id: matter.id,
          overlay_type: 'MixedFileConfirmed',
          is_active: true,
        });
      }

      return matter;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['stateCounts'] });
    },
  });
}

export function useLogAction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: LogActionInput) => {
      // Insert action
      const { data: action, error } = await supabase
        .from('actions')
        .insert({
          ...input,
          action_date: input.action_date || new Date().toISOString(),
          evidence_type: input.evidence_type || 'Unknown',
          date_confidence: input.date_confidence || 'Exact',
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-generate deadlines and tasks based on action type
      if (input.action_type === 'Dispute Sent' && input.delivered_date && input.entity_case_id) {
        const deliveredDate = new Date(input.delivered_date);
        const dueDate30 = addDays(deliveredDate, 30);
        const checkDate25 = addDays(deliveredDate, 25);

        // Create §611 30-day deadline
        await supabase.from('deadlines').insert({
          matter_id: input.matter_id,
          entity_case_id: input.entity_case_id,
          deadline_type: '611_30day' as DeadlineType,
          start_date: input.delivered_date,
          due_date: dueDate30.toISOString(),
          status: 'Open',
          source_action_id: action.id,
        });

        // Create D+25 report check task
        await supabase.from('tasks').insert({
          matter_id: input.matter_id,
          entity_case_id: input.entity_case_id,
          task_type: 'Check Credit Report (CRA)',
          priority: 'P1' as TaskPriority,
          due_date: checkDate25.toISOString(),
          status: 'Pending',
          auto_generated: true,
        });

        // Update entity case state
        await supabase
          .from('entity_cases')
          .update({ state: 'DisputeActive', last_action_at: new Date().toISOString() })
          .eq('id', input.entity_case_id);

        // Update matter state if needed
        await supabase
          .from('matters')
          .update({ primary_state: 'DisputeActive' })
          .eq('id', input.matter_id)
          .eq('primary_state', 'DisputePreparation');
      }

      if (input.action_type === 'CFPB Complaint Filed' && input.entity_case_id) {
        const filedDate = new Date(input.action_date || new Date());
        
        // Create CFPB deadlines
        await supabase.from('deadlines').insert([
          {
            matter_id: input.matter_id,
            entity_case_id: input.entity_case_id,
            deadline_type: 'CFPB_15' as DeadlineType,
            start_date: filedDate.toISOString(),
            due_date: addDays(filedDate, 15).toISOString(),
            status: 'Open',
            source_action_id: action.id,
          },
          {
            matter_id: input.matter_id,
            entity_case_id: input.entity_case_id,
            deadline_type: 'CFPB_60' as DeadlineType,
            start_date: filedDate.toISOString(),
            due_date: addDays(filedDate, 60).toISOString(),
            status: 'Open',
            source_action_id: action.id,
          },
        ]);

        // Create CFPB check tasks
        await supabase.from('tasks').insert([
          {
            matter_id: input.matter_id,
            entity_case_id: input.entity_case_id,
            task_type: 'Check CFPB Portal',
            priority: 'P1' as TaskPriority,
            due_date: addDays(filedDate, 15).toISOString(),
            status: 'Pending',
            auto_generated: true,
          },
          {
            matter_id: input.matter_id,
            entity_case_id: input.entity_case_id,
            task_type: 'Check CFPB Portal',
            priority: 'P1' as TaskPriority,
            due_date: addDays(filedDate, 60).toISOString(),
            status: 'Pending',
            auto_generated: true,
          },
        ]);

        // Update matter state
        await supabase
          .from('matters')
          .update({ primary_state: 'RegulatoryReview' })
          .eq('id', input.matter_id);
      }

      if (input.action_type === 'Data Broker Freeze Submitted' && input.entity_case_id) {
        // Create follow-up task
        await supabase.from('tasks').insert({
          matter_id: input.matter_id,
          entity_case_id: input.entity_case_id,
          task_type: 'Check Data Broker Freeze Status',
          priority: 'P2' as TaskPriority,
          due_date: addDays(new Date(), 14).toISOString(),
          status: 'Pending',
          auto_generated: true,
        });
      }

      return action;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['stateCounts'] });
      queryClient.invalidateQueries({ queryKey: ['entityCases'] });
    },
  });
}

export function useLogResponse() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: LogResponseInput) => {
      // Insert response
      const { data: response, error } = await supabase
        .from('responses')
        .insert({
          ...input,
          received_date: input.received_date || new Date().toISOString(),
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Handle response type effects
      if (input.response_type === 'Reinserted') {
        // Create violation
        await supabase.from('violations').insert({
          matter_id: input.matter_id,
          entity_case_id: input.entity_case_id,
          trigger: 'Reinsertion611a5B',
          statutory_section: '§611(a)(5)(B)',
          severity: 5,
          evidence_attached: false,
        });

        // Create immediate check task
        await supabase.from('tasks').insert([
          {
            matter_id: input.matter_id,
            entity_case_id: input.entity_case_id,
            task_type: 'Check Credit Report (CRA)',
            priority: 'P0' as TaskPriority,
            due_date: new Date().toISOString(),
            status: 'Pending',
            auto_generated: true,
          },
          {
            matter_id: input.matter_id,
            entity_case_id: input.entity_case_id,
            task_type: 'Check Credit Report (CRA)',
            priority: 'P0' as TaskPriority,
            due_date: addDays(new Date(), 7).toISOString(),
            status: 'Pending',
            auto_generated: true,
          },
        ]);

        // Update states
        await supabase
          .from('entity_cases')
          .update({ state: 'ReinsertionDetected', last_action_at: new Date().toISOString() })
          .eq('id', input.entity_case_id);

        await supabase
          .from('matters')
          .update({ primary_state: 'ReinsertionDetected' })
          .eq('id', input.matter_id);
      }

      if (input.response_type === 'NoResponse') {
        // Create violation for missed deadline
        await supabase.from('violations').insert({
          matter_id: input.matter_id,
          entity_case_id: input.entity_case_id,
          trigger: 'Missed611Deadline',
          statutory_section: '§611(a)(1)',
          severity: 3,
          evidence_attached: false,
        });

        await supabase
          .from('entity_cases')
          .update({ state: 'ViolationConfirmed', last_action_at: new Date().toISOString() })
          .eq('id', input.entity_case_id);

        await supabase
          .from('matters')
          .update({ primary_state: 'ViolationConfirmed' })
          .eq('id', input.matter_id);
      }

      if (input.response_type === 'Deleted') {
        await supabase
          .from('entity_cases')
          .update({ state: 'Resolved', last_action_at: new Date().toISOString() })
          .eq('id', input.entity_case_id);
      }

      if (input.response_type === 'PartialDeleted') {
        await supabase
          .from('entity_cases')
          .update({ state: 'PartialCompliance', last_action_at: new Date().toISOString() })
          .eq('id', input.entity_case_id);

        await supabase
          .from('matters')
          .update({ primary_state: 'PartialCompliance' })
          .eq('id', input.matter_id)
          .in('primary_state', ['DisputeActive', 'DisputePreparation']);
      }

      if (input.response_type === 'Boilerplate') {
        await supabase.from('violations').insert({
          matter_id: input.matter_id,
          entity_case_id: input.entity_case_id,
          trigger: 'Boilerplate',
          statutory_section: '§611(a)',
          severity: 3,
          evidence_attached: false,
        });

        await supabase
          .from('entity_cases')
          .update({ state: 'ViolationConfirmed', last_action_at: new Date().toISOString() })
          .eq('id', input.entity_case_id);
      }

      // Close related deadlines
      await supabase
        .from('deadlines')
        .update({ status: 'Closed' })
        .eq('entity_case_id', input.entity_case_id)
        .in('status', ['Open', 'DueSoon', 'Overdue']);

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responses'] });
      queryClient.invalidateQueries({ queryKey: ['violations'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['stateCounts'] });
      queryClient.invalidateQueries({ queryKey: ['entityCases'] });
      queryClient.invalidateQueries({ queryKey: ['reinsertionMatters'] });
    },
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, status, notes }: { taskId: string; status: 'Pending' | 'InProgress' | 'Done' | 'Blocked'; notes?: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({ 
          status, 
          completion_notes: notes,
          completed_at: status === 'Done' ? new Date().toISOString() : null,
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
