-- A) Add explicit owner field to matters and authorize on that (self-authorizing)

-- 1) Add column (nullable initially for backfill)
ALTER TABLE public.matters
ADD COLUMN IF NOT EXISTS owner_id uuid;

-- 2) Backfill existing rows using related client owner
UPDATE public.matters m
SET owner_id = c.owner_id
FROM public.clients c
WHERE c.id = m.client_id
  AND m.owner_id IS NULL;

-- 3) Ensure any remaining NULLs are filled (safety) - default to auth.uid() when run as a user
UPDATE public.matters
SET owner_id = auth.uid()
WHERE owner_id IS NULL;

-- 4) Set DEFAULT + NOT NULL
ALTER TABLE public.matters
ALTER COLUMN owner_id SET DEFAULT auth.uid();

ALTER TABLE public.matters
ALTER COLUMN owner_id SET NOT NULL;

-- 5) Replace INSERT RLS policy to use owner_id directly (no clients join)
DROP POLICY IF EXISTS "Users can insert matters for owned clients" ON public.matters;
CREATE POLICY "Users can insert matters for owned clients"
ON public.matters
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
  )
);

-- B) Update atomic RPC to explicitly set owner_id on BOTH inserts
CREATE OR REPLACE FUNCTION public.create_client_and_matter(
  _legal_name text,
  _matter_type public.matter_type,
  _intake_raw_text text,
  _intake_source text,
  _client_notes text DEFAULT NULL
)
RETURNS TABLE(client_id uuid, matter_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_legal_name text;
  v_client_id uuid;
  v_matter_id uuid;
  v_intake_text text;
  v_intake_source text;
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

  -- Step 1: client (explicit owner_id)
  INSERT INTO public.clients (legal_name, owner_id, status, notes)
  VALUES (
    v_legal_name,
    auth.uid(),
    'Active',
    nullif(btrim(_client_notes), '')
  )
  RETURNING id INTO v_client_id;

  -- Step 2: matter (explicit owner_id, linked)
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
    auth.uid(),
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

REVOKE ALL ON FUNCTION public.create_client_and_matter(text, public.matter_type, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_client_and_matter(text, public.matter_type, text, text, text) TO authenticated;
