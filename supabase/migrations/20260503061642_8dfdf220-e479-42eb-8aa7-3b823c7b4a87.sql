-- B4: Furnishers as a first-class category
CREATE TABLE IF NOT EXISTS public.furnishers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_last4 text,
  account_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT furnishers_account_last4_format
    CHECK (account_last4 IS NULL OR account_last4 ~ '^[0-9]{4}$')
);

-- One furnisher per (client, name, account_last4). NULL account_last4 is
-- treated as a distinct value so "OneMain (no acct)" and "OneMain (#1234)"
-- coexist; we add a partial unique index for the NULL case to enforce one
-- name with no account per client.
CREATE UNIQUE INDEX IF NOT EXISTS furnishers_unique_with_acct
  ON public.furnishers (client_id, lower(name), account_last4)
  WHERE account_last4 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS furnishers_unique_no_acct
  ON public.furnishers (client_id, lower(name))
  WHERE account_last4 IS NULL;

CREATE INDEX IF NOT EXISTS furnishers_client_idx ON public.furnishers (client_id);

ALTER TABLE public.furnishers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view furnishers"
  ON public.furnishers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert furnishers"
  ON public.furnishers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update furnishers"
  ON public.furnishers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete furnishers"
  ON public.furnishers FOR DELETE TO authenticated USING (true);

-- updated_at trigger reuses the project's standard helper
DROP TRIGGER IF EXISTS furnishers_set_updated_at ON public.furnishers;
CREATE TRIGGER furnishers_set_updated_at
  BEFORE UPDATE ON public.furnishers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Additive link from timeline_events
ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS furnisher_id uuid
  REFERENCES public.furnishers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS timeline_events_furnisher_idx
  ON public.timeline_events (furnisher_id)
  WHERE furnisher_id IS NOT NULL;