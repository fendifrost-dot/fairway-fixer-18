-- ============================================================================
-- B3 — Storage bucket lockdown (Continuum hard-launch audit)
-- ----------------------------------------------------------------------------
-- Creates the three document buckets that hold client PII (dispute letters,
-- source credit reports, generated deliverables) as PRIVATE, and adds
-- owner/admin-scoped RLS on storage.objects.
--
-- Object-key convention:  <client_id>/<filename>
-- The leading path segment is the owning client's id, so access is granted only
-- when public.can_access_client(<client_id>) is true (owner_id = auth.uid()
-- OR public.is_admin()).
--
-- NOTE: Edge functions upload/read via the service role (RLS bypass) and via
-- short-lived signed URLs, so these policies do not affect server-side flows;
-- they exist to guarantee that NO anon/public or cross-owner browser access to
-- these objects is possible.
-- ============================================================================

-- 1) Create buckets as PRIVATE (idempotent; force public=false if they exist).
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('client-letters', 'client-letters', false),
  ('source-reports', 'source-reports', false),
  ('client-deliverables', 'client-deliverables', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2) Helper: safely parse the leading path segment as a client uuid.
--    Returns NULL for malformed paths so policies fail closed (deny).
CREATE OR REPLACE FUNCTION public.storage_object_client_id(_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, storage, pg_catalog
AS $$
DECLARE
  seg text;
BEGIN
  seg := (storage.foldername(_name))[1];
  IF seg IS NULL OR seg = '' THEN
    RETURN NULL;
  END IF;
  RETURN seg::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- 3) Owner/admin-scoped policies on storage.objects for these three buckets.
--    Applied to the `authenticated` role only (anon/public get nothing).
DO $storage_policies$
DECLARE
  b text;
  buckets text[] := ARRAY['client-letters', 'source-reports', 'client-deliverables'];
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    -- SELECT
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON storage.objects',
      b || '_select_owner_admin'
    );
    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = %L
          AND public.can_access_client(public.storage_object_client_id(name))
        )
    $p$, b || '_select_owner_admin', b);

    -- INSERT
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON storage.objects',
      b || '_insert_owner_admin'
    );
    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = %L
          AND public.can_access_client(public.storage_object_client_id(name))
        )
    $p$, b || '_insert_owner_admin', b);

    -- UPDATE
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON storage.objects',
      b || '_update_owner_admin'
    );
    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects
        FOR UPDATE TO authenticated
        USING (
          bucket_id = %L
          AND public.can_access_client(public.storage_object_client_id(name))
        )
        WITH CHECK (
          bucket_id = %L
          AND public.can_access_client(public.storage_object_client_id(name))
        )
    $p$, b || '_update_owner_admin', b, b);

    -- DELETE
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON storage.objects',
      b || '_delete_owner_admin'
    );
    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects
        FOR DELETE TO authenticated
        USING (
          bucket_id = %L
          AND public.can_access_client(public.storage_object_client_id(name))
        )
    $p$, b || '_delete_owner_admin', b);
  END LOOP;
END;
$storage_policies$;
