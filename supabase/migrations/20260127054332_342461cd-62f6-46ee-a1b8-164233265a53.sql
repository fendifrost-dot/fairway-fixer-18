-- Ultimate diagnostic: capture trigger execution + RLS evaluation
CREATE OR REPLACE FUNCTION public.diagnose_matters_insert(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid uuid;
  v_client_exists boolean;
  v_insert_id uuid;
  v_err_code text;
  v_err_msg text;
  v_err_detail text;
  v_err_hint text;
BEGIN
  v_uid := auth.uid();
  
  -- Test if client_exists works
  BEGIN
    v_client_exists := public.client_exists(p_client_id);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;
    RETURN jsonb_build_object(
      'stage', 'client_exists_check',
      'auth_uid', v_uid,
      'client_id', p_client_id,
      'error_code', v_err_code,
      'error_message', v_err_msg
    );
  END;
  
  IF NOT v_client_exists THEN
    RETURN jsonb_build_object(
      'stage', 'client_exists_check',
      'auth_uid', v_uid,
      'client_id', p_client_id,
      'client_exists', false,
      'error_message', 'Client does not exist'
    );
  END IF;
  
  -- Now attempt the insert with explicit owner_id
  BEGIN
    INSERT INTO public.matters (client_id, owner_id, title, matter_type)
    VALUES (p_client_id, v_uid, 'DIAGNOSTIC TEST', 'Credit')
    RETURNING id INTO v_insert_id;
    
    -- If we get here, delete the test row
    DELETE FROM public.matters WHERE id = v_insert_id;
    
    RETURN jsonb_build_object(
      'stage', 'insert_success',
      'auth_uid', v_uid,
      'client_id', p_client_id,
      'client_exists', true,
      'inserted_id', v_insert_id,
      'success', true
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS 
      v_err_code = RETURNED_SQLSTATE, 
      v_err_msg = MESSAGE_TEXT,
      v_err_detail = PG_EXCEPTION_DETAIL,
      v_err_hint = PG_EXCEPTION_HINT;
    
    RETURN jsonb_build_object(
      'stage', 'insert_failed',
      'auth_uid', v_uid,
      'owner_id_attempted', v_uid,
      'client_id', p_client_id,
      'client_exists', true,
      'error_code', v_err_code,
      'error_message', v_err_msg,
      'error_detail', v_err_detail,
      'error_hint', v_err_hint
    );
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.diagnose_matters_insert(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnose_matters_insert(uuid) TO authenticated;