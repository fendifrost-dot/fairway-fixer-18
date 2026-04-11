
-- Drop existing owner-scoped policies
DROP POLICY IF EXISTS "Users can view owned clients or admin" ON public.clients;
DROP POLICY IF EXISTS "Users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update owned clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete owned clients" ON public.clients;

-- Create open policies for all authenticated users
CREATE POLICY "Authenticated users can view all clients"
ON public.clients FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert clients"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
ON public.clients FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete clients"
ON public.clients FOR DELETE TO authenticated
USING (true);
