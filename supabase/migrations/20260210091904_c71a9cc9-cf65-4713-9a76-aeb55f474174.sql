-- Atomic baseline commit: deactivate old, insert new baseline + targets
-- Returns jsonb: { baseline_id, targets_inserted }

CREATE OR REPLACE FUNCTION public.commit_baseline(
  _client_id uuid,
  _source_type text,
  _original_text text,
  _targets jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_baseline_id uuid;
  v_targets_inserted int;
BEGIN
  -- Authorization: caller must own this client
  IF NOT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = _client_id AND owner_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not authorized for client %', _client_id;
  END IF;

  -- Step 1: deactivate existing active baselines for this client
  UPDATE public.baseline_analyses
  SET is_active = false, updated_at = now()
  WHERE client_id = _client_id AND is_active = true;

  -- Step 2: insert new active baseline
  INSERT INTO public.baseline_analyses (client_id, source_type, original_text, is_active)
  VALUES (_client_id, _source_type, _original_text, true)
  RETURNING id INTO v_baseline_id;

  -- Step 3: insert targets from jsonb array
  INSERT INTO public.baseline_targets (baseline_id, bureau, item_type, label, fingerprint, raw_fields, status)
  SELECT
    v_baseline_id,
    (t->>'bureau')::public.baseline_bureau,
    t->>'item_type',
    t->>'label',
    t->>'fingerprint',
    COALESCE(t->'raw_fields', '{}'::jsonb),
    COALESCE((t->>'status')::public.baseline_target_status, 'pending'::public.baseline_target_status)
  FROM jsonb_array_elements(_targets) AS t;

  GET DIAGNOSTICS v_targets_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'baseline_id', v_baseline_id,
    'targets_inserted', v_targets_inserted
  );
END;
$function$;

-- Security: only authenticated users can call this
REVOKE ALL ON FUNCTION public.commit_baseline(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_baseline(uuid, text, text, jsonb) TO authenticated;