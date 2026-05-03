-- Status enum for tradelines
DO $$ BEGIN
  CREATE TYPE public.tradeline_status AS ENUM ('active', 'disputed', 'deleted', 'verified', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Bureau enum for per-bureau pivot rows
DO $$ BEGIN
  CREATE TYPE public.tradeline_bureau AS ENUM ('equifax', 'experian', 'transunion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tradelines
CREATE TABLE IF NOT EXISTS public.tradelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  furnisher_id uuid REFERENCES public.furnishers(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  account_last4 text,
  balance numeric,
  opened_date date,
  status public.tradeline_status NOT NULL DEFAULT 'unknown',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tradelines_client_id ON public.tradelines(client_id);
CREATE INDEX IF NOT EXISTS idx_tradelines_furnisher_id ON public.tradelines(furnisher_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tradelines_client_name_last4
  ON public.tradelines(client_id, lower(display_name), COALESCE(account_last4, ''));

ALTER TABLE public.tradelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tradelines" ON public.tradelines
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert tradelines" ON public.tradelines
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update tradelines" ON public.tradelines
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete tradelines" ON public.tradelines
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_tradelines_updated_at
  BEFORE UPDATE ON public.tradelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Per-bureau pivot rows
CREATE TABLE IF NOT EXISTS public.tradeline_bureau_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tradeline_id uuid NOT NULL REFERENCES public.tradelines(id) ON DELETE CASCADE,
  bureau public.tradeline_bureau NOT NULL,
  present boolean NOT NULL DEFAULT false,
  status_on_bureau text,
  last_seen_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tradeline_id, bureau)
);

CREATE INDEX IF NOT EXISTS idx_tbs_tradeline_id ON public.tradeline_bureau_states(tradeline_id);

ALTER TABLE public.tradeline_bureau_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tradeline_bureau_states" ON public.tradeline_bureau_states
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert tradeline_bureau_states" ON public.tradeline_bureau_states
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update tradeline_bureau_states" ON public.tradeline_bureau_states
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete tradeline_bureau_states" ON public.tradeline_bureau_states
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_tbs_updated_at
  BEFORE UPDATE ON public.tradeline_bureau_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add tradeline_id to timeline_events (additive, nullable)
ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS tradeline_id uuid REFERENCES public.tradelines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_timeline_events_tradeline_id ON public.timeline_events(tradeline_id);