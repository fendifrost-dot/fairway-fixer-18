BEGIN;

CREATE OR REPLACE FUNCTION public.__dbg_matters_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_claim text;
BEGIN
  v_claim := current_setting('request.jwt.claim.sub', true);
  RAISE EXCEPTION
    'DBG_MATTERS_INSERT new.owner_id=%, auth.uid()=%, jwt.sub=%, current_user=%',
    NEW.owner_id,
    auth.uid(),
    v_claim,
    current_user;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS __dbg_matters_before_insert ON public.matters;

CREATE TRIGGER __dbg_matters_before_insert
BEFORE INSERT ON public.matters
FOR EACH ROW
EXECUTE FUNCTION public.__dbg_matters_before_insert();

COMMIT;