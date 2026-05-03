-- Status enum for dispute rounds
DO $$ BEGIN
  CREATE TYPE public.dispute_round_status AS ENUM (
    'planning', 'mailed', 'awaiting_response', 'response_received', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Dispute rounds table
CREATE TABLE IF NOT EXISTS public.dispute_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number > 0),
  submitted_at date,
  completed_at date,
  status public.dispute_round_status NOT NULL DEFAULT 'planning',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_dispute_rounds_client ON public.dispute_rounds(client_id);

ALTER TABLE public.dispute_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view dispute rounds"
  ON public.dispute_rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert dispute rounds"
  ON public.dispute_rounds FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update dispute rounds"
  ON public.dispute_rounds FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete dispute rounds"
  ON public.dispute_rounds FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_dispute_rounds_updated_at
  BEFORE UPDATE ON public.dispute_rounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Additive: round_id on timeline_events (nullable; existing events stay null)
ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES public.dispute_rounds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_timeline_events_round ON public.timeline_events(round_id);

-- Note: there is no separate unresolved_items / open_items table in this schema.
-- Unresolved items currently live in-memory (parser output) and surface via UnresolvedStatePanel.
-- Round grouping for unresolved items will be handled client-side in the parser/panel.