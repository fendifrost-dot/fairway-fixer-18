import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientWithMatters {
  id: string;
  legal_name: string;
  preferred_name: string | null;
  email: string | null;
  phone: string | null;
  status: 'Active' | 'Inactive' | 'Pending';
  notes: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  matter_count: number;
}

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      // Fetch clients
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .order('legal_name', { ascending: true });

      if (clientsError) {
        throw clientsError;
      }

      // Fetch matter counts per client
      const { data: matters, error: mattersError } = await supabase
        .from('matters')
        .select('client_id');

      if (mattersError) {
        console.error('Error fetching matters:', mattersError);
      }

      // Count matters per client
      const matterCounts: Record<string, number> = {};
      matters?.forEach(m => {
        matterCounts[m.client_id] = (matterCounts[m.client_id] || 0) + 1;
      });

      // Combine data
      const clientsWithMatters: ClientWithMatters[] = clients.map(client => ({
        ...client,
        status: client.status as 'Active' | 'Inactive' | 'Pending',
        matter_count: matterCounts[client.id] || 0,
      }));

      return clientsWithMatters;
    },
  });
}

export function useClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client', clientId],
    queryFn: async () => {
      if (!clientId) return null;

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
    enabled: !!clientId,
  });
}
