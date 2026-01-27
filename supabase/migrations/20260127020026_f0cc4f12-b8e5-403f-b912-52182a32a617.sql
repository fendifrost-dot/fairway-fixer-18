-- Ensure RPC execution is NOT available to anon (require authenticated)
REVOKE EXECUTE ON FUNCTION public.create_client_and_matter(text, public.matter_type, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.whoami() FROM anon;

-- Keep explicit grants
GRANT EXECUTE ON FUNCTION public.create_client_and_matter(text, public.matter_type, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.whoami() TO authenticated;
