BEGIN;

-- 1) Confirm owner_id default exists (harmless if already set)
ALTER TABLE public.matters
  ALTER COLUMN owner_id SET DEFAULT auth.uid();

COMMIT;