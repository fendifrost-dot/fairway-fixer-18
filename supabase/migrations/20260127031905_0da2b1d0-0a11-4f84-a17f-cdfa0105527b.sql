BEGIN;

-- 1) Create a helper that snapshots RLS + policy state for public.matters (pg_policy is source of truth)
CREATE OR REPLACE FUNCTION public.__snapshot_matters_rls()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'now', now(),
    'current_user', current_user,
    'session_user', session_user,
    'role', current_setting('role', true),
    'row_security', current_setting('row_security', true),
    'jwt_sub', current_setting('request.jwt.claim.sub', true),
    'auth_uid', auth.uid(),
    'auth_role', auth.role(),
    'matters_regclass', to_regclass('public.matters')::text,
    'matters_oid', (to_regclass('public.matters'))::oid,
    'matters_rls', (
      SELECT jsonb_build_object(
        'relrowsecurity', c.relrowsecurity,
        'relforcerowsecurity', c.relforcerowsecurity,
        'owner', pg_get_userbyid(c.relowner),
        'relkind', c.relkind
      )
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname='matters'
    ),
    'policies', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'polname', p.polname,
          'cmd', p.polcmd,
          'permissive', p.polpermissive,
          'roles', array_to_string(p.polroles::regrole[], ','),
          'using', pg_get_expr(p.polqual, p.polrelid),
          'with_check', pg_get_expr(p.polwithcheck, p.polrelid)
        )
        ORDER BY p.polcmd, p.polpermissive, p.polname
      ), '[]'::jsonb)
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='public' AND c.relname='matters'
    )
  );
$$;

REVOKE ALL ON FUNCTION public.__snapshot_matters_rls() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.__snapshot_matters_rls() TO authenticated;

COMMIT;