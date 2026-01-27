BEGIN;

-- 1) INTROSPECT REAL POLICY ROWS (pg_policy), including permissive vs restrictive
SELECT
  p.polname,
  p.polcmd,
  p.polpermissive,
  array_to_string(p.polroles::regrole[], ',') as roles,
  pg_get_expr(p.polqual, p.polrelid)       AS using_expr,
  pg_get_expr(p.polwithcheck, p.polrelid)  AS withcheck_expr
FROM pg_policy p
JOIN pg_class  c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relname='matters'
ORDER BY p.polcmd, p.polpermissive, p.polname;

-- 2) NUCLEAR RESET: DROP *ALL* POLICIES ON public.matters (ALL COMMANDS, ALL NAMES)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='matters'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.matters;', r.polname);
  END LOOP;
END $$;

-- 3) CREATE A TEMPORARY "ALLOW ALL INSERT" POLICY (THIS IS A DIAGNOSTIC PROOF)
CREATE POLICY __matters_insert_allow_all
ON public.matters
FOR INSERT
WITH CHECK (true);

COMMIT;