-- Create a minimal test function that:
-- 1) Captures auth.uid() at multiple points
-- 2) Attempts a raw INSERT into matters (without catching exception)
-- This will prove whether auth.uid() is consistent

CREATE OR REPLACE FUNCTION public.test_matters_insert_rls()
RETURNS TABLE(
  step text,
  auth_uid_value uuid,
  auth_role_value text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_uid uuid;
BEGIN
  -- Step 1: Capture auth context
  step := 'initial';
  auth_uid_value := auth.uid();
  auth_role_value := auth.role();
  RETURN NEXT;

  v_uid := auth.uid();

  -- Step 2: Create a test client
  INSERT INTO public.clients (legal_name, owner_id, status)
  VALUES ('RLS Test Client', v_uid, 'Active')
  RETURNING id INTO v_client_id;

  step := 'after_client_insert';
  auth_uid_value := auth.uid();
  auth_role_value := auth.role();
  RETURN NEXT;

  -- Step 3: Attempt matter insert (this is where RLS fails)
  -- Using explicit owner_id = auth.uid()
  INSERT INTO public.matters (
    client_id,
    owner_id,
    title,
    matter_type,
    jurisdiction,
    primary_state
  )
  VALUES (
    v_client_id,
    v_uid,  -- This should equal auth.uid()
    'RLS Test Matter',
    'Credit',
    'Federal (FCRA)',
    'DisputePreparation'
  );

  step := 'after_matter_insert';
  auth_uid_value := auth.uid();
  auth_role_value := auth.role();
  RETURN NEXT;

  -- Cleanup: delete the test records
  DELETE FROM public.matters WHERE title = 'RLS Test Matter';
  DELETE FROM public.clients WHERE legal_name = 'RLS Test Client';

  step := 'cleanup_done';
  auth_uid_value := auth.uid();
  auth_role_value := auth.role();
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.test_matters_insert_rls() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_matters_insert_rls() TO authenticated;
