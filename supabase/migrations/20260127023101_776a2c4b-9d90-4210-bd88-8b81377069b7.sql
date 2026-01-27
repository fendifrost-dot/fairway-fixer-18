BEGIN;

-- Replace INSERT policy to avoid non-short-circuit evaluation of an EXISTS(subquery)
-- inside RLS (which can trigger 42501 even when owner_id = auth.uid()).
DROP POLICY IF EXISTS "Users can insert matters for owned clients" ON public.matters;

CREATE POLICY "Users can insert matters for owned clients"
ON public.matters
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  OR public.is_admin()
);

COMMIT;