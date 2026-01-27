-- Fix: Set owner_id in a BEFORE INSERT trigger so it's set before RLS evaluates
-- This ensures the WITH CHECK (owner_id = auth.uid()) sees the correct value

CREATE OR REPLACE FUNCTION public.set_matters_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Always set owner_id to auth.uid() on insert, regardless of what was passed
  -- This ensures RLS WITH CHECK sees the correct value
  NEW.owner_id := auth.uid();
  RETURN NEW;
END;
$$;

-- Create trigger that runs BEFORE INSERT, before the client_exists check
-- Using a name that sorts before 'enforce_matters_client_exists' alphabetically
DROP TRIGGER IF EXISTS a_set_matters_owner_id ON public.matters;
CREATE TRIGGER a_set_matters_owner_id
  BEFORE INSERT ON public.matters
  FOR EACH ROW
  EXECUTE FUNCTION public.set_matters_owner_id();

-- Also update the RLS policy to handle edge cases where owner_id might be checked
-- before the trigger runs (shouldn't happen with proper trigger ordering, but belt-and-suspenders)
DROP POLICY IF EXISTS matters_insert_owner_only ON public.matters;
CREATE POLICY matters_insert_owner_only ON public.matters
  FOR INSERT TO authenticated
  WITH CHECK (
    -- After trigger runs, owner_id will equal auth.uid()
    owner_id = auth.uid()
  );