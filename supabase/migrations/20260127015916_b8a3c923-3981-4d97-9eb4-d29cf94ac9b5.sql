-- 1) WHOAMI diagnostic RPC
CREATE OR REPLACE FUNCTION public.whoami()
RETURNS TABLE(
  uid uuid,
  role text,
  db_user text,
  jwt jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT auth.uid(), auth.role(), current_user::text, auth.jwt();
$$;

REVOKE ALL ON FUNCTION public.whoami() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whoami() TO authenticated;
