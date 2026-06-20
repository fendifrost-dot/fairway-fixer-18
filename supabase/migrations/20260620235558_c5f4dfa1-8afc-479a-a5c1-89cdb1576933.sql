
DO $$ BEGIN
  CREATE TYPE public.dispute_letter_status AS ENUM ('draft', 'final', 'mailed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.dispute_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  round_id UUID REFERENCES public.dispute_rounds(id) ON DELETE SET NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('cra', 'furnisher', 'collector', 'regulator')),
  recipient_name TEXT NOT NULL,
  letter_type TEXT NOT NULL,
  body_md TEXT NOT NULL,
  body_docx_path TEXT,
  statutes JSONB NOT NULL DEFAULT '[]'::jsonb,
  tradeline_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  strength_checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.dispute_letter_status NOT NULL DEFAULT 'draft',
  timeline_event_id UUID REFERENCES public.timeline_events(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispute_letters TO authenticated;
GRANT ALL ON public.dispute_letters TO service_role;

CREATE TABLE IF NOT EXISTS public.weekly_update_renderings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  round_id UUID REFERENCES public.dispute_rounds(id) ON DELETE SET NULL,
  generated_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  include_dates_in_body BOOLEAN NOT NULL DEFAULT false,
  custom_status_summary TEXT,
  output_storage_path TEXT NOT NULL,
  letters_action_table_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_update_renderings TO authenticated;
GRANT ALL ON public.weekly_update_renderings TO service_role;

DROP TRIGGER IF EXISTS update_dispute_letters_updated_at ON public.dispute_letters;
CREATE TRIGGER update_dispute_letters_updated_at
  BEFORE UPDATE ON public.dispute_letters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.dispute_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_update_renderings ENABLE ROW LEVEL SECURITY;

DO $policies$ BEGIN
  DROP POLICY IF EXISTS "Users can view dispute letters" ON public.dispute_letters;
  CREATE POLICY "Users can view dispute letters" ON public.dispute_letters FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert dispute letters" ON public.dispute_letters;
  CREATE POLICY "Users can insert dispute letters" ON public.dispute_letters FOR INSERT WITH CHECK (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can update dispute letters" ON public.dispute_letters;
  CREATE POLICY "Users can update dispute letters" ON public.dispute_letters FOR UPDATE USING (can_access_client(client_id));

  DROP POLICY IF EXISTS "Users can view weekly update renderings" ON public.weekly_update_renderings;
  CREATE POLICY "Users can view weekly update renderings" ON public.weekly_update_renderings FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert weekly update renderings" ON public.weekly_update_renderings;
  CREATE POLICY "Users can insert weekly update renderings" ON public.weekly_update_renderings FOR INSERT WITH CHECK (can_access_client(client_id));
END $policies$;
