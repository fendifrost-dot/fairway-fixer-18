
CREATE OR REPLACE FUNCTION public.can_access_client(_client_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients WHERE id = _client_id
  )
$$;
