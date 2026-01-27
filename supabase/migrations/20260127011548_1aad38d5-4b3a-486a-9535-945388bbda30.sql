-- Fix the matters INSERT policy to use direct subquery instead of SECURITY DEFINER function
-- This ensures auth.uid() is evaluated in the correct context

DROP POLICY IF EXISTS "Users can insert matters for owned clients" ON public.matters;

CREATE POLICY "Users can insert matters for owned clients" 
ON public.matters 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id = client_id AND owner_id = auth.uid()
  )
  OR public.is_admin()
);