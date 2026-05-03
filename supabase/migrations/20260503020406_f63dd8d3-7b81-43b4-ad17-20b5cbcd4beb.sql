-- B1: Structured identity fields
-- Add the two missing columns; the others (date_of_birth, ssn_last4, phone, email) already exist.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS current_address text,
  ADD COLUMN IF NOT EXISTS alternate_addresses text[] NOT NULL DEFAULT ARRAY[]::text[];

-- Validate ssn_last4 = exactly 4 numeric chars when not null.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_ssn_last4_format'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_ssn_last4_format
      CHECK (ssn_last4 IS NULL OR ssn_last4 ~ '^[0-9]{4}$');
  END IF;
END $$;

-- Update the atomic create RPC to accept identity fields.
CREATE OR REPLACE FUNCTION public.create_client_and_matter(
  _legal_name text,
  _matter_type matter_type,
  _intake_raw_text text,
  _intake_source text,
  _client_notes text DEFAULT NULL,
  _dob date DEFAULT NULL,
  _current_address text DEFAULT NULL,
  _ssn_last4 text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _alternate_addresses text[] DEFAULT NULL
)
RETURNS TABLE(client_id uuid, matter_id uuid)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_legal_name text;
  v_client_id uuid;
  v_matter_id uuid;
  v_intake_text text;
  v_intake_source text;
  v_uid uuid := auth.uid();
  v_phone text;
  v_email text;
  v_ssn text;
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

  -- Normalize phone to digits only
  v_phone := nullif(regexp_replace(coalesce(_phone, ''), '\D', '', 'g'), '');
  v_email := nullif(btrim(lower(coalesce(_email, ''))), '');
  v_ssn := nullif(btrim(coalesce(_ssn_last4, '')), '');
  IF v_ssn IS NOT NULL AND v_ssn !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'ssn_last4 must be exactly 4 digits';
  END IF;

  INSERT INTO public.clients (
    legal_name, owner_id, status, notes,
    date_of_birth, current_address, ssn_last4, phone, email, alternate_addresses
  )
  VALUES (
    v_legal_name, v_uid, 'Active', nullif(btrim(_client_notes), ''),
    _dob,
    nullif(btrim(coalesce(_current_address, '')), ''),
    v_ssn,
    v_phone,
    v_email,
    COALESCE(_alternate_addresses, ARRAY[]::text[])
  )
  RETURNING id INTO v_client_id;

  INSERT INTO public.matters (
    client_id, owner_id, title, matter_type, jurisdiction, primary_state,
    intake_raw_text, intake_source, intake_created_at
  )
  VALUES (
    v_client_id, v_uid,
    v_legal_name || ' - ' || _matter_type::text || ' Matter',
    _matter_type, 'Federal (FCRA)', 'DisputePreparation',
    v_intake_text, v_intake_source,
    CASE WHEN v_intake_text IS NULL THEN NULL ELSE now() END
  )
  RETURNING id INTO v_matter_id;

  RETURN QUERY SELECT v_client_id, v_matter_id;
END;
$function$;

-- Update the debug RPC the dialog actually calls.
CREATE OR REPLACE FUNCTION public.debug_create_client_and_matter(
  _legal_name text,
  _matter_type matter_type,
  _intake_raw_text text,
  _intake_source text,
  _client_notes text DEFAULT NULL,
  _dob date DEFAULT NULL,
  _current_address text DEFAULT NULL,
  _ssn_last4 text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _alternate_addresses text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_legal_name text;
  v_intake_text text;
  v_intake_source text;
  v_client_id uuid;
  v_client_owner uuid;
  v_matter_id uuid;
  v_client_visible boolean;
  v_phone text;
  v_email text;
  v_ssn text;
  err_code text; err_msg text; err_detail text; err_hint text;
  err_table text; err_column text; err_constraint text;
BEGIN
  v_legal_name := left(nullif(btrim(_legal_name), ''), 100);
  IF v_legal_name IS NULL THEN v_legal_name := 'New Client'; END IF;
  v_intake_text := nullif(btrim(_intake_raw_text), '');
  v_intake_source := left(nullif(btrim(_intake_source), ''), 100);
  IF v_intake_source IS NULL THEN v_intake_source := 'Manual'; END IF;

  v_phone := nullif(regexp_replace(coalesce(_phone, ''), '\D', '', 'g'), '');
  v_email := nullif(btrim(lower(coalesce(_email, ''))), '');
  v_ssn := nullif(btrim(coalesce(_ssn_last4, '')), '');
  IF v_ssn IS NOT NULL AND v_ssn !~ '^[0-9]{4}$' THEN
    RETURN jsonb_build_object(
      'caller_uid', v_uid,
      'error_code', 'IDENT001',
      'error_message', 'ssn_last4 must be exactly 4 digits',
      'error_stage', 'identity_validation'
    );
  END IF;

  INSERT INTO public.clients (
    legal_name, owner_id, status, notes,
    date_of_birth, current_address, ssn_last4, phone, email, alternate_addresses
  )
  VALUES (
    v_legal_name, v_uid, 'Active', nullif(btrim(_client_notes), ''),
    _dob,
    nullif(btrim(coalesce(_current_address, '')), ''),
    v_ssn, v_phone, v_email,
    COALESCE(_alternate_addresses, ARRAY[]::text[])
  )
  RETURNING id, owner_id INTO v_client_id, v_client_owner;

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

  BEGIN
    INSERT INTO public.matters (
      client_id, owner_id, title, matter_type, jurisdiction, primary_state,
      intake_raw_text, intake_source, intake_created_at
    )
    VALUES (
      v_client_id, v_uid,
      v_legal_name || ' - ' || _matter_type::text || ' Matter',
      _matter_type, 'Federal (FCRA)', 'DisputePreparation',
      v_intake_text, v_intake_source,
      CASE WHEN v_intake_text IS NULL THEN NULL ELSE now() END
    )
    RETURNING id INTO v_matter_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      err_code = RETURNED_SQLSTATE, err_msg = MESSAGE_TEXT,
      err_detail = PG_EXCEPTION_DETAIL, err_hint = PG_EXCEPTION_HINT,
      err_table = TABLE_NAME, err_column = COLUMN_NAME, err_constraint = CONSTRAINT_NAME;
    RETURN jsonb_build_object(
      'caller_uid', v_uid,
      'inserted_client_id', v_client_id,
      'inserted_client_owner_id', v_client_owner,
      'client_visible_after_insert', v_client_visible,
      'attempted_matter_client_id', v_client_id,
      'attempted_matter_owner_id', v_uid,
      'error_code', err_code, 'error_message', err_msg,
      'error_detail', err_detail, 'error_hint', err_hint,
      'error_table', err_table, 'error_column', err_column,
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
$function$;