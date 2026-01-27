BEGIN;

-- 1) Add a temporary BEFORE INSERT trigger that logs owner_id + auth.uid() and then lets insert proceed
CREATE OR REPLACE FUNCTION public.__dbg_matters_payload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE NOTICE 'DBG_PAYLOAD matters.owner_id=%, auth.uid()=%', NEW.owner_id, auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS __dbg_matters_payload ON public.matters;

CREATE TRIGGER __dbg_matters_payload
BEFORE INSERT ON public.matters
FOR EACH ROW
EXECUTE FUNCTION public.__dbg_matters_payload();

COMMIT;