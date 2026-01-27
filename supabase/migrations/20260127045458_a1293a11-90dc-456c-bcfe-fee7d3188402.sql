-- Drop old function with TABLE return type
DROP FUNCTION IF EXISTS public.debug_create_client_and_matter(text, matter_type, text, text, text);

-- Create new version returning jsonb
CREATE OR REPLACE FUNCTION public.debug_create_client_and_matter(
  _legal_name text,
  _matter_type matter_type,
  _intake_raw_text text,
  _intake_source text,
  _client_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_legal_name text;
  v_intake_text text;
  v_intake_source text;
  v_client_id uuid;
  v_client_owner uuid;
  v_matter_id uuid;
  v_client_visible boolean;
  err_code text;
  err_msg text;
  err_detail text;
  err_hint text;
  err_table text;
  err_column text;
  err_constraint text;
BEGIN
  -- Normalize inputs
  v_legal_name := left(nullif(btrim(_legal_name), ''), 100);
  IF v_legal_name IS NULL THEN
    v_legal_name := 'New Client';
  END IF;
  v_intake_text := nullif(btrim(_intake_raw_text), '');
  v_intake_source := left(nullif(btrim(_intake_source), ''), 100);
  IF v_intake_source IS NULL THEN
    v_intake_source := 'Manual';
  END IF;

  -- STEP 1: Create client
  INSERT INTO public.clients (legal_name, owner_id, status, notes)
  VALUES (v_legal_name, v_uid, 'Active', nullif(btrim(_client_notes), ''))
  RETURNING id, owner_id INTO v_client_id, v_client_owner;

  -- STEP 2: Assert client row is visible in same transaction
  SELECT EXISTS(SELECT 1 FROM public.clients WHERE id = v_client_id) INTO v_client_visible;
  
  IF NOT v_client_visible THEN
    RETURN jsonb_build_object(
      'caller_uid', v_uid,
      'inserted_client_id', v_client_id,
      'client_visible_after_insert', false,
      'error_code', 'DBG001',
      'error_message', 'Client row not visible after INSERT in same transaction',
      'error_stage', 'client_visibility_check'
    );
  END IF;

  -- STEP 3: Create matter using ONLY v_client_id
  BEGIN
    INSERT INTO public.matters (
      client_id,
      owner_id,
      title,
      matter_type,
      jurisdiction,
      primary_state,
      intake_raw_text,
      intake_source,
      intake_created_at
    )
    VALUES (
      v_client_id,
      v_uid,
      v_legal_name || ' - ' || _matter_type::text || ' Matter',
      _matter_type,
      'Federal (FCRA)',
      'DisputePreparation',
      v_intake_text,
      v_intake_source,
      CASE WHEN v_intake_text IS NULL THEN NULL ELSE now() END
    )
    RETURNING id INTO v_matter_id;
    
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      err_code = RETURNED_SQLSTATE,
      err_msg = MESSAGE_TEXT,
      err_detail = PG_EXCEPTION_DETAIL,
      err_hint = PG_EXCEPTION_HINT,
      err_table = TABLE_NAME,
      err_column = COLUMN_NAME,
      err_constraint = CONSTRAINT_NAME;
      
    RETURN jsonb_build_object(
      'caller_uid', v_uid,
      'inserted_client_id', v_client_id,
      'inserted_client_owner_id', v_client_owner,
      'client_visible_after_insert', v_client_visible,
      'attempted_matter_client_id', v_client_id,
      'attempted_matter_owner_id', v_uid,
      'error_code', err_code,
      'error_message', err_msg,
      'error_detail', err_detail,
      'error_hint', err_hint,
      'error_table', err_table,
      'error_column', err_column,
      'error_constraint', err_constraint,
      'error_stage', 'matter_insert'
    );
  END;

  RETURN jsonb_build_object(
    'caller_uid', v_uid,
    'inserted_client_id', v_client_id,
    'inserted_client_owner_id', v_client_owner,
    'client_visible_after_insert', true,
    'inserted_matter_id', v_matter_id,
    'success', true
  );
END;
$$;

-- Update production RPC with SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.create_client_and_matter(
  _legal_name text,
  _matter_type matter_type,
  _intake_raw_text text,
  _intake_source text,
  _client_notes text DEFAULT NULL
)
RETURNS TABLE(client_id uuid, matter_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_legal_name text;
  v_client_id uuid;
  v_matter_id uuid;
  v_intake_text text;
  v_intake_source text;
  v_uid uuid := auth.uid();
BEGIN
  v_legal_name := left(nullif(btrim(_legal_name), ''), 100);
  IF v_legal_name IS NULL THEN
    v_legal_name := 'New Client';
  END IF;
  v_intake_text := nullif(btrim(_intake_raw_text), '');
  v_intake_source := left(nullif(btrim(_intake_source), ''), 100);
  IF v_intake_source IS NULL THEN
    v_intake_source := 'Manual';
  END IF;

  INSERT INTO public.clients (legal_name, owner_id, status, notes)
  VALUES (v_legal_name, v_uid, 'Active', nullif(btrim(_client_notes), ''))
  RETURNING id INTO v_client_id;

  INSERT INTO public.matters (
    client_id,
    owner_id,
    title,
    matter_type,
    jurisdiction,
    primary_state,
    intake_raw_text,
    intake_source,
    intake_created_at
  )
  VALUES (
    v_client_id,
    v_uid,
    v_legal_name || ' - ' || _matter_type::text || ' Matter',
    _matter_type,
    'Federal (FCRA)',
    'DisputePreparation',
    v_intake_text,
    v_intake_source,
    CASE WHEN v_intake_text IS NULL THEN NULL ELSE now() END
  )
  RETURNING id INTO v_matter_id;

  RETURN QUERY SELECT v_client_id, v_matter_id;
END;
$$;

REVOKE ALL ON FUNCTION public.debug_create_client_and_matter(text, matter_type, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_create_client_and_matter(text, matter_type, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_client_and_matter(text, matter_type, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client_and_matter(text, matter_type, text, text, text) TO authenticated;