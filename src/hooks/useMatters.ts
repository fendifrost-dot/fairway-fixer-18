import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MatterWithRelations {
  id: string;
  client_id: string;
  title: string;
  matter_type: 'Credit' | 'Consulting' | 'Both';
  primary_state: string;
  jurisdiction: string | null;
  escalation_strategy: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  intake_raw_text: string | null;
  intake_source: string | null;
  intake_created_at: string | null;
  client: {
    id: string;
    legal_name: string;
    preferred_name: string | null;
    email: string | null;
    phone: string | null;
    status: 'Active' | 'Inactive' | 'Pending';
    notes: string | null;
    created_at: string;
    owner_id: string | null;
  } | null;
  entity_cases?: {
    id: string;
    entity_name: string;
    entity_type: 'CRA' | 'Furnisher' | 'DataBroker' | 'Agency';
    state: string;
  }[];
  violations?: {
    id: string;
    trigger: string;
    severity: number;
    statutory_section: string;
  }[];
  deadlines?: {
    id: string;
    deadline_type: string;
    due_date: string;
    status: string;
  }[];
  overlays?: {
    id: string;
    overlay_type: string;
    is_active: boolean;
  }[];
}

export function useMattersWithRelations() {
  return useQuery({
    queryKey: ['matters-with-relations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matters')
        .select(`
          *,
          client:clients(*),
          entity_cases:entity_cases(*),
          violations:violations(*),
          deadlines:deadlines(*),
          overlays:overlays(*)
        `)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Our schema intentionally does not declare a FK from matters -> clients.
      // Supabase typing marks nested selects as SelectQueryError, but runtime data is OK.
      return (data as unknown) as MatterWithRelations[];
    },
  });
}

export function useMatter(matterId: string | undefined) {
  return useQuery({
    queryKey: ['matter', matterId],
    queryFn: async () => {
      if (!matterId) return null;

      const { data, error } = await supabase
        .from('matters')
        .select(`
          *,
          client:clients(*),
          entity_cases:entity_cases(*),
          violations:violations(*),
          deadlines:deadlines(*),
          overlays:overlays(*)
        `)
        .eq('id', matterId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      // See note above about missing FK relationship typing.
      return (data as unknown) as MatterWithRelations | null;
    },
    enabled: !!matterId,
  });
}
