
-- Deletion audit log table (no PII stored)
CREATE TABLE public.deletion_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_client_id uuid NOT NULL,
  deleted_by_user_id uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deletion_mode text NOT NULL DEFAULT 'standard',
  export_created boolean NOT NULL DEFAULT false,
  matter_count int NOT NULL DEFAULT 0,
  event_count int NOT NULL DEFAULT 0,
  reason text
);

ALTER TABLE public.deletion_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deletion logs"
  ON public.deletion_audit_log FOR SELECT
  USING (deleted_by_user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Insert deletion logs"
  ON public.deletion_audit_log FOR INSERT
  WITH CHECK (deleted_by_user_id = auth.uid());

-- Full cascade deletion RPC
CREATE OR REPLACE FUNCTION public.delete_client_cascade(
  _client_id uuid,
  _elevated_confirm boolean DEFAULT false,
  _export_created boolean DEFAULT false,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner_id uuid;
  v_risky_states text[];
  v_matter_ids uuid[];
  v_matter_count int := 0;
  v_event_count int := 0;
BEGIN
  -- STEP 1: Auth check - verify caller owns client
  SELECT owner_id INTO v_owner_id FROM public.clients WHERE id = _client_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'client_not_found');
  END IF;

  IF v_owner_id != v_uid AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authorized');
  END IF;

  -- STEP 2: Check for high-risk matter states
  SELECT array_agg(DISTINCT primary_state::text)
  INTO v_risky_states
  FROM public.matters
  WHERE client_id = _client_id
    AND primary_state IN ('LitigationReady', 'EscalationEligible');

  IF v_risky_states IS NOT NULL AND array_length(v_risky_states, 1) > 0 AND NOT _elevated_confirm THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'elevated_confirmation_required',
      'risky_states', to_jsonb(v_risky_states)
    );
  END IF;

  -- STEP 3: Collect matter IDs
  SELECT array_agg(id), count(*) INTO v_matter_ids, v_matter_count
  FROM public.matters WHERE client_id = _client_id;

  -- STEP 4: Delete all matter children (order: deepest first)
  IF v_matter_ids IS NOT NULL THEN
    DELETE FROM public.case_actions WHERE case_id = ANY(v_matter_ids);
    DELETE FROM public.violations WHERE matter_id = ANY(v_matter_ids);
    DELETE FROM public.overlays WHERE matter_id = ANY(v_matter_ids);
    DELETE FROM public.deadlines WHERE matter_id = ANY(v_matter_ids);
    DELETE FROM public.responses WHERE matter_id = ANY(v_matter_ids);
    DELETE FROM public.actions WHERE matter_id = ANY(v_matter_ids);
    DELETE FROM public.tasks WHERE matter_id = ANY(v_matter_ids);
    DELETE FROM public.entity_cases WHERE matter_id = ANY(v_matter_ids);
    DELETE FROM public.matters WHERE client_id = _client_id;
  END IF;

  -- STEP 5: Delete source_corrections via timeline_events
  DELETE FROM public.source_corrections
  WHERE event_id IN (SELECT id FROM public.timeline_events WHERE client_id = _client_id);

  -- STEP 6: Delete timeline events
  SELECT count(*) INTO v_event_count FROM public.timeline_events WHERE client_id = _client_id;
  DELETE FROM public.timeline_events WHERE client_id = _client_id;

  -- STEP 7: Delete baseline targets via baseline analyses
  DELETE FROM public.baseline_targets
  WHERE baseline_id IN (SELECT id FROM public.baseline_analyses WHERE client_id = _client_id);
  DELETE FROM public.baseline_analyses WHERE client_id = _client_id;

  -- STEP 8: Delete operator tasks
  DELETE FROM public.operator_tasks WHERE client_id = _client_id;

  -- STEP 9: Delete the client row
  DELETE FROM public.clients WHERE id = _client_id;

  -- STEP 10: Write audit log (no PII - IDs and counts only)
  -- TODO: When storage buckets are added, delete storage objects here
  INSERT INTO public.deletion_audit_log (
    deleted_client_id, deleted_by_user_id, deletion_mode, export_created,
    matter_count, event_count, reason
  ) VALUES (
    _client_id, v_uid,
    CASE WHEN v_risky_states IS NOT NULL THEN 'elevated' ELSE 'standard' END,
    _export_created, v_matter_count, v_event_count, _reason
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_matters', v_matter_count,
    'deleted_events', v_event_count
  );
END;
$$;
