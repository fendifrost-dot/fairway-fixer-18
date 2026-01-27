-- Probe function to test 3 owner_id insertion variants
CREATE OR REPLACE FUNCTION public.probe_matters_ownerid_variants(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid uuid := auth.uid();
  a_id uuid; a_code text; a_msg text;
  b_id uuid; b_code text; b_msg text;
  c_id uuid; c_code text; c_msg text;
BEGIN
  -- A) owner_id omitted (DEFAULT should apply)
  BEGIN
    INSERT INTO public.matters (client_id, title, matter_type)
    VALUES (p_client_id, 'PROBE A', 'Credit')
    RETURNING id INTO a_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS a_code = RETURNED_SQLSTATE, a_msg = MESSAGE_TEXT;
  END;

  -- B) owner_id explicit auth.uid()
  BEGIN
    INSERT INTO public.matters (client_id, owner_id, title, matter_type)
    VALUES (p_client_id, v_uid, 'PROBE B', 'Credit')
    RETURNING id INTO b_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS b_code = RETURNED_SQLSTATE, b_msg = MESSAGE_TEXT;
  END;

  -- C) owner_id explicit NULL (should fail if policy is active)
  BEGIN
    INSERT INTO public.matters (client_id, owner_id, title, matter_type)
    VALUES (p_client_id, NULL, 'PROBE C', 'Credit')
    RETURNING id INTO c_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS c_code = RETURNED_SQLSTATE, c_msg = MESSAGE_TEXT;
  END;

  RETURN jsonb_build_object(
    'auth_uid', v_uid,
    'client_id', p_client_id,
    'policy_expected', 'WITH CHECK (owner_id = auth.uid())',
    'attempt_A_owner_omitted', jsonb_build_object('inserted_id', a_id, 'error_code', a_code, 'error_message', a_msg),
    'attempt_B_owner_explicit_uid', jsonb_build_object('inserted_id', b_id, 'error_code', b_code, 'error_message', b_msg),
    'attempt_C_owner_explicit_null', jsonb_build_object('inserted_id', c_id, 'error_code', c_code, 'error_message', c_msg)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.probe_matters_ownerid_variants(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.probe_matters_ownerid_variants(uuid) TO authenticated;