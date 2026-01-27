BEGIN;

-- 1) Add owner_id to matters (if missing)
ALTER TABLE public.matters
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) Enforce owner_id at DB layer (default + not null)
ALTER TABLE public.matters
  ALTER COLUMN owner_id SET DEFAULT auth.uid();

-- If you already have rows, backfill before NOT NULL
UPDATE public.matters
SET owner_id = COALESCE(owner_id, (
  SELECT c.owner_id FROM public.clients c WHERE c.id = public.matters.client_id
))
WHERE owner_id IS NULL;

ALTER TABLE public.matters
  ALTER COLUMN owner_id SET NOT NULL;

-- 3) Drop ALL existing INSERT policies on matters (fixed column name: policyname)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='matters'
      AND cmd='INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.matters;', r.policyname);
  END LOOP;
END $$;

-- 4) Create a single, owner-only INSERT policy (no joins, no functions)
CREATE POLICY matters_insert_owner_only
ON public.matters
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

COMMIT;