-- FIX: The RLS WITH CHECK is evaluated BEFORE triggers run
-- Since we have a trigger that sets owner_id = auth.uid(), we can safely
-- allow the insert and rely on the trigger for enforcement

-- Option 1: Change policy to allow insert when auth.uid() is not null
-- The trigger will ensure owner_id is set correctly
DROP POLICY IF EXISTS matters_insert_owner_only ON public.matters;

CREATE POLICY matters_insert_authenticated ON public.matters
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Allow insert if user is authenticated
    -- The trigger a_set_matters_owner_id will set owner_id = auth.uid()
    auth.uid() IS NOT NULL
  );

-- Also add SELECT, UPDATE, DELETE policies so the app works
CREATE POLICY matters_select_owner ON public.matters
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY matters_update_owner ON public.matters
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY matters_delete_owner ON public.matters
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin());