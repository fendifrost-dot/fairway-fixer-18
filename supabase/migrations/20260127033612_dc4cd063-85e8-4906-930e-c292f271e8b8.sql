BEGIN;

-- 0) Explicitly drop the policy first (known name)
DROP POLICY IF EXISTS matters_insert_owner_only ON public.matters;
DROP POLICY IF EXISTS __matters_insert_allow_all ON public.matters;

-- 1) Ensure matters is self-authorizing (owner_id on matters)
ALTER TABLE public.matters
  ADD COLUMN IF NOT EXISTS owner_id uuid;

ALTER TABLE public.matters
  ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- Backfill owner_id for existing rows (best-effort)
UPDATE public.matters m
SET owner_id = COALESCE(m.owner_id, c.owner_id)
FROM public.clients c
WHERE m.client_id = c.id
  AND m.owner_id IS NULL;

ALTER TABLE public.matters
  ALTER COLUMN owner_id SET NOT NULL;

-- 2) Remove FK chain(s) that can force implicit reads under RLS
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.matters'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.matters DROP CONSTRAINT IF EXISTS %I;', r.conname);
  END LOOP;
END $$;

-- 3) SECURITY DEFINER existence function
CREATE OR REPLACE FUNCTION public.client_exists(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.clients WHERE id = _id);
$$;

REVOKE ALL ON FUNCTION public.client_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_exists(uuid) TO authenticated;

-- 4) Enforce client existence without FK (trigger validation)
CREATE OR REPLACE FUNCTION public.enforce_matters_client_exists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NULL THEN
    RAISE EXCEPTION 'client_id is required';
  END IF;

  IF NOT public.client_exists(NEW.client_id) THEN
    RAISE EXCEPTION 'client_id % does not exist', NEW.client_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_matters_client_exists ON public.matters;

CREATE TRIGGER enforce_matters_client_exists
BEFORE INSERT OR UPDATE OF client_id ON public.matters
FOR EACH ROW
EXECUTE FUNCTION public.enforce_matters_client_exists();

-- 5) Drop ALL remaining INSERT policies on matters
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public'
      AND c.relname='matters'
      AND p.polcmd='i'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.matters;', r.polname);
  END LOOP;
END $$;

-- Create ONE insert policy only
CREATE POLICY matters_insert_owner_only
ON public.matters
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

COMMIT;