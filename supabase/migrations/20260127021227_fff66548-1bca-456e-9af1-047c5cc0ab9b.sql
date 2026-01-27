-- 1) Temporary debug wrapper RPC for client+matter creation
-- Captures auth context INSIDE the function + attempted insert values.
-- Uses a single block so any failure rolls back both inserts (no orphan clients).

CREATE OR REPLACE FUNCTION public.debug_create_client_and_matter(
  _legal_name text,
  _matter_type public.matter_type,
  _intake_raw_text text,
  _intake_source text,
  _client_notes text DEFAULT NULL
)
RETURNS TABLE(
  caller_uid uuid,
  caller_role text,
  db_user text,
  inserted_client_id uuid,
  inserted_client_owner_id uuid,
  inserted_matter_id uuid,
  attempted_matter_owner_id uuid,
  error_code text,
  error_message text,
  error_stage text
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_legal_name text;
  v_intake_text text;
  v_intake_source text;
  v_client_id uuid;
  v_matter_id uuid;
  v_client_owner uuid;
  v_attempt_owner uuid;
  v_err_code text;
  v_err_msg text;
BEGIN
  caller_uid := auth.uid();
  caller_role := auth.role();
  db_user := current_user::text;

  v_attempt_owner := caller_uid;

  v_legal_name := left(nullif(btrim(_legal_name), ''), 100);
  IF v_legal_name IS NULL THEN
    v_legal_name := 'New Client';
  END IF;

  v_intake_text := nullif(btrim(_intake_raw_text), '');
  v_intake_source := left(nullif(btrim(_intake_source), ''), 100);
  IF v_intake_source IS NULL THEN
    v_intake_source := 'Manual';
  END IF;

  BEGIN
    -- Step 1: client
    INSERT INTO public.clients (legal_name, owner_id, status, notes)
    VALUES (
      v_legal_name,
      caller_uid,
      'Active',
      nullif(btrim(_client_notes), '')
    )
    RETURNING id, owner_id INTO v_client_id, v_client_owner;

    -- Step 2: matter
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
      v_attempt_owner,
      v_legal_name || ' - ' || _matter_type::text || ' Matter',
      _matter_type,
      'Federal (FCRA)',
      'DisputePreparation',
      v_intake_text,
      v_intake_source,
      CASE WHEN v_intake_text IS NULL THEN NULL ELSE now() END
    )
    RETURNING id INTO v_matter_id;

    inserted_client_id := v_client_id;
    inserted_client_owner_id := v_client_owner;
    inserted_matter_id := v_matter_id;
    attempted_matter_owner_id := v_attempt_owner;

    error_code := NULL;
    error_message := NULL;
    error_stage := NULL;

    RETURN NEXT;
    RETURN;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE, v_err_msg = MESSAGE_TEXT;

    inserted_client_id := v_client_id;
    inserted_client_owner_id := v_client_owner;
    inserted_matter_id := v_matter_id;
    attempted_matter_owner_id := v_attempt_owner;

    error_code := v_err_code;
    error_message := v_err_msg;
    error_stage := 'insert';

    RETURN NEXT;
    RETURN;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.debug_create_client_and_matter(text, public.matter_type, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debug_create_client_and_matter(text, public.matter_type, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.debug_create_client_and_matter(text, public.matter_type, text, text, text) TO authenticated;
