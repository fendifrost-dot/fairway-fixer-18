-- Prove what auth.uid() and JWT claims resolve to in write context
CREATE OR REPLACE FUNCTION public.prove_request_claims()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_claims text;
  v_sub text;
  v_role text;
  v_uid uuid;
BEGIN
  v_claims := current_setting('request.jwt.claims', true);
  v_sub := current_setting('request.jwt.claim.sub', true);
  v_role := current_setting('request.jwt.claim.role', true);
  v_uid := auth.uid();

  RETURN jsonb_build_object(
    'current_user', current_user,
    'session_user', session_user,
    'role_setting', current_setting('role', true),
    'request_jwt_claims', v_claims,
    'jwt_sub_setting', v_sub,
    'jwt_role_setting', v_role,
    'auth_uid', v_uid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prove_request_claims() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prove_request_claims() TO authenticated;