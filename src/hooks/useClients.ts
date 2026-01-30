import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Client {
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
}

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      try {
        const { data: clients, error: clientsError } = await supabase
          .from('clients')
          .select('*')
          .order('legal_name', { ascending: true });

        if (clientsError) {
          console.error('Error fetching clients:', clientsError);
          throw clientsError;
        }

        const typedClients: Client[] = (clients || []).map(client => ({
          ...client,
          status: client.status as 'Active' | 'Inactive' | 'Pending',
        }));

        return typedClients;
      } catch (error) {
        console.error('useClients error:', error);
        throw error;
      }
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
