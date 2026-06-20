-- Persist Credit Guardian Analyzer output per credit report snapshot.

CREATE TABLE IF NOT EXISTS public.credit_report_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_report_id UUID NOT NULL REFERENCES public.credit_reports(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  violations JSONB NOT NULL DEFAULT '[]'::jsonb,
  baseline_summary TEXT,
  letter_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (credit_report_id)
);

CREATE INDEX IF NOT EXISTS credit_report_analyses_client_id_idx
  ON public.credit_report_analyses (client_id);

DROP TRIGGER IF EXISTS update_credit_report_analyses_updated_at ON public.credit_report_analyses;
CREATE TRIGGER update_credit_report_analyses_updated_at
  BEFORE UPDATE ON public.credit_report_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.credit_report_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view credit report analyses" ON public.credit_report_analyses;
CREATE POLICY "Users can view credit report analyses" ON public.credit_report_analyses
  FOR SELECT USING (can_access_client(client_id));

DROP POLICY IF EXISTS "Users can insert credit report analyses" ON public.credit_report_analyses;
CREATE POLICY "Users can insert credit report analyses" ON public.credit_report_analyses
  FOR INSERT WITH CHECK (can_access_client(client_id));

DROP POLICY IF EXISTS "Users can update credit report analyses" ON public.credit_report_analyses;
CREATE POLICY "Users can update credit report analyses" ON public.credit_report_analyses
  FOR UPDATE USING (can_access_client(client_id));
