CREATE TABLE public.diagnostic_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  subject_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  detected_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, signal_type, subject_ids)
);

CREATE INDEX idx_diagnostic_signals_client ON public.diagnostic_signals(client_id);
CREATE INDEX idx_diagnostic_signals_undismissed ON public.diagnostic_signals(client_id) WHERE dismissed_at IS NULL;

ALTER TABLE public.diagnostic_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view diagnostic_signals"
  ON public.diagnostic_signals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert diagnostic_signals"
  ON public.diagnostic_signals FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update diagnostic_signals"
  ON public.diagnostic_signals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete diagnostic_signals"
  ON public.diagnostic_signals FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_diagnostic_signals_updated_at
  BEFORE UPDATE ON public.diagnostic_signals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();