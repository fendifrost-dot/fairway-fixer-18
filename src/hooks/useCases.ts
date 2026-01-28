import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CaseWithClient {
  id: string;
  client_id: string;
  title: string;
  matter_type: 'Credit' | 'Consulting' | 'Both';
  primary_state: string;
  jurisdiction: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  client: {
    id: string;
    legal_name: string;
    preferred_name: string | null;
    email: string | null;
    phone: string | null;
    status: 'Active' | 'Inactive' | 'Pending';
  } | null;
}

export function useCasesWithClients() {
  return useQuery({
    queryKey: ['cases-with-clients'],
    queryFn: async () => {
      // Fetch matters and clients separately due to no FK
      const { data: matters, error: mattersError } = await supabase
        .from('matters')
        .select('*')
        .order('updated_at', { ascending: false });

      if (mattersError) throw mattersError;

      const clientIds = [...new Set(matters?.map(m => m.client_id) ?? [])];
      
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .in('id', clientIds);

      if (clientsError) throw clientsError;

      const clientMap = new Map(clients?.map(c => [c.id, c]) ?? []);

      return matters?.map(matter => ({
        ...matter,
        client: clientMap.get(matter.client_id) || null,
      })) as CaseWithClient[];
    },
  });
}

export function useCase(caseId: string | undefined) {
  return useQuery({
    queryKey: ['case', caseId],
    queryFn: async () => {
      if (!caseId) return null;

      const { data: matter, error: matterError } = await supabase
        .from('matters')
        .select('*')
        .eq('id', caseId)
        .maybeSingle();

      if (matterError) throw matterError;
      if (!matter) return null;

      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', matter.client_id)
        .maybeSingle();

      if (clientError) throw clientError;

      return {
        ...matter,
        client,
      } as CaseWithClient;
    },
    enabled: !!caseId,
  });
}
