CREATE OR REPLACE FUNCTION public.probe_matters_insert(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_unqualified_id uuid;
  v_qualified_id uuid;
  v_unqualified_regclass text;
  v_qualified_regclass text;
  err1_code text := null;
  err1_msg  text := null;
  err2_code text := null;
  err2_msg  text := null;
  snap_before jsonb;
BEGIN
  snap_before := public.__snapshot_matters_rls();

  -- Attempt 1: UNQUALIFIED
  BEGIN
    INSERT INTO matters (client_id, owner_id)
    VALUES (p_client_id, v_uid)
    RETURNING id, tableoid::regclass::text INTO v_unqualified_id, v_unqualified_regclass;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err1_code = RETURNED_SQLSTATE, err1_msg = MESSAGE_TEXT;
  END;

  -- Attempt 2: QUALIFIED
  BEGIN
    INSERT INTO public.matters (client_id, owner_id)
    VALUES (p_client_id, v_uid)
    RETURNING id, tableoid::regclass::text INTO v_qualified_id, v_qualified_regclass;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err2_code = RETURNED_SQLSTATE, err2_msg = MESSAGE_TEXT;
  END;

  RETURN jsonb_build_object(
    'auth_uid', v_uid,
    'to_regclass_matters', to_regclass('matters')::text,
    'to_regclass_public_matters', to_regclass('public.matters')::text,
    'snapshot_before', snap_before,
    'unqualified_attempt', jsonb_build_object(
      'inserted_id', v_unqualified_id,
      'inserted_table', v_unqualified_regclass,
      'error_code', err1_code,
      'error_message', err1_msg
    ),
    'qualified_attempt', jsonb_build_object(
      'inserted_id', v_qualified_id,
      'inserted_table', v_qualified_regclass,
      'error_code', err2_code,
      'error_message', err2_msg
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.probe_matters_insert(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.probe_matters_insert(uuid) TO authenticated;