-- Credit Guardian optimization: credit reports, tradelines, letters, weekly updates, billing
-- W1–W4 schema (2026-06-05 directive)

-- Enums
DO $$ BEGIN
  CREATE TYPE public.credit_bureau AS ENUM ('equifax', 'experian', 'transunion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dispute_letter_status AS ENUM ('draft', 'final', 'mailed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_plan_status AS ENUM ('active', 'completed', 'delinquent', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('scheduled', 'paid', 'partial', 'overdue', 'waived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Client fields for weekly update
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS ftc_identity_theft_report_number TEXT,
  ADD COLUMN IF NOT EXISTS legal_full_name TEXT,
  ADD COLUMN IF NOT EXISTS campaign_label TEXT;

-- Furnishers (B4)
CREATE TABLE IF NOT EXISTS public.furnishers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_last4 TEXT,
  account_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, name, account_last4)
);

-- Dispute rounds
CREATE TABLE IF NOT EXISTS public.dispute_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, round_number)
);

-- Credit report snapshots
CREATE TABLE IF NOT EXISTS public.credit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  bureau public.credit_bureau NOT NULL,
  report_date DATE NOT NULL,
  import_scope TEXT NOT NULL DEFAULT 'full_snapshot'
    CHECK (import_scope IN ('full_snapshot', 'partial_update', 'furnisher_update')),
  source_type TEXT NOT NULL DEFAULT 'paste'
    CHECK (source_type IN ('paste', 'pdf', 'image', 'csv', 'txt')),
  source_storage_path TEXT,
  raw_text TEXT,
  parse_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tradelines
CREATE TABLE IF NOT EXISTS public.tradelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  furnisher_id UUID REFERENCES public.furnishers(id) ON DELETE SET NULL,
  identity_key TEXT NOT NULL,
  furnisher_raw TEXT NOT NULL,
  furnisher_normalized TEXT NOT NULL,
  account_mask TEXT,
  date_opened DATE,
  loan_type TEXT,
  display_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_id, identity_key)
);

CREATE INDEX IF NOT EXISTS tradelines_client_id_idx ON public.tradelines (client_id);

-- Per-bureau tradeline state (canonical row data lives here)
CREATE TABLE IF NOT EXISTS public.tradeline_bureau_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tradeline_id UUID NOT NULL REFERENCES public.tradelines(id) ON DELETE CASCADE,
  credit_report_id UUID REFERENCES public.credit_reports(id) ON DELETE SET NULL,
  bureau public.credit_bureau NOT NULL,
  present BOOLEAN NOT NULL DEFAULT true,
  absent_in_latest BOOLEAN NOT NULL DEFAULT false,
  status_on_bureau TEXT,
  date_reported DATE,
  balance NUMERIC,
  high_balance NUMERIC,
  past_due NUMERIC,
  monthly_payment NUMERIC,
  pay_status TEXT,
  account_status TEXT,
  remarks JSONB NOT NULL DEFAULT '[]'::jsonb,
  two_year_payment_grid JSONB NOT NULL DEFAULT '[]'::jsonb,
  dispute_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  parse_confidence NUMERIC,
  last_seen_date DATE,
  operator_disputed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tradeline_id, bureau)
);

-- Bureau / furnisher responses (W1C)
CREATE TABLE IF NOT EXISTS public.bureau_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  tradeline_id UUID REFERENCES public.tradelines(id) ON DELETE SET NULL,
  round_id UUID REFERENCES public.dispute_rounds(id) ON DELETE SET NULL,
  bureau public.credit_bureau,
  furnisher_id UUID REFERENCES public.furnishers(id) ON DELETE SET NULL,
  response_date DATE,
  result TEXT NOT NULL DEFAULT 'unknown'
    CHECK (result IN ('verified', 'updated', 'deleted', 'no-response', 'frivolous', 'unknown')),
  free_text TEXT,
  source_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dispute letters (W2)
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

-- Weekly update audit (W3)
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

-- Payment plans (W4)
CREATE TABLE IF NOT EXISTS public.payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('paid_in_full', 'installments')),
  total_amount NUMERIC NOT NULL,
  installment_amount NUMERIC,
  frequency TEXT CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'custom')),
  num_installments INT,
  start_date DATE NOT NULL,
  status public.payment_plan_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount_due NUMERIC NOT NULL,
  amount_paid NUMERIC,
  paid_date DATE,
  method TEXT CHECK (method IN ('card', 'ACH', 'Zelle', 'cash', 'other')),
  status public.payment_status NOT NULL DEFAULT 'scheduled',
  gcal_event_id TEXT,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Timeline extensions
ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES public.dispute_rounds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS furnisher_id UUID REFERENCES public.furnishers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tradeline_id UUID REFERENCES public.tradelines(id) ON DELETE SET NULL;

-- Triggers
DROP TRIGGER IF EXISTS update_furnishers_updated_at ON public.furnishers;
CREATE TRIGGER update_furnishers_updated_at
  BEFORE UPDATE ON public.furnishers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tradelines_updated_at ON public.tradelines;
CREATE TRIGGER update_tradelines_updated_at
  BEFORE UPDATE ON public.tradelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tradeline_bureau_states_updated_at ON public.tradeline_bureau_states;
CREATE TRIGGER update_tradeline_bureau_states_updated_at
  BEFORE UPDATE ON public.tradeline_bureau_states
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_dispute_letters_updated_at ON public.dispute_letters;
CREATE TRIGGER update_dispute_letters_updated_at
  BEFORE UPDATE ON public.dispute_letters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_plans_updated_at ON public.payment_plans;
CREATE TRIGGER update_payment_plans_updated_at
  BEFORE UPDATE ON public.payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.furnishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tradeline_bureau_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bureau_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_update_renderings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policies (idempotent)
DO $policies$ BEGIN
  -- furnishers
  DROP POLICY IF EXISTS "Users can view furnishers" ON public.furnishers;
  CREATE POLICY "Users can view furnishers" ON public.furnishers FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert furnishers" ON public.furnishers;
  CREATE POLICY "Users can insert furnishers" ON public.furnishers FOR INSERT WITH CHECK (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can update furnishers" ON public.furnishers;
  CREATE POLICY "Users can update furnishers" ON public.furnishers FOR UPDATE USING (can_access_client(client_id));

  -- dispute_rounds
  DROP POLICY IF EXISTS "Users can view dispute rounds" ON public.dispute_rounds;
  CREATE POLICY "Users can view dispute rounds" ON public.dispute_rounds FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert dispute rounds" ON public.dispute_rounds;
  CREATE POLICY "Users can insert dispute rounds" ON public.dispute_rounds FOR INSERT WITH CHECK (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can update dispute rounds" ON public.dispute_rounds;
  CREATE POLICY "Users can update dispute rounds" ON public.dispute_rounds FOR UPDATE USING (can_access_client(client_id));

  -- credit_reports
  DROP POLICY IF EXISTS "Users can view credit reports" ON public.credit_reports;
  CREATE POLICY "Users can view credit reports" ON public.credit_reports FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert credit reports" ON public.credit_reports;
  CREATE POLICY "Users can insert credit reports" ON public.credit_reports FOR INSERT WITH CHECK (can_access_client(client_id));

  -- tradelines
  DROP POLICY IF EXISTS "Users can view tradelines" ON public.tradelines;
  CREATE POLICY "Users can view tradelines" ON public.tradelines FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert tradelines" ON public.tradelines;
  CREATE POLICY "Users can insert tradelines" ON public.tradelines FOR INSERT WITH CHECK (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can update tradelines" ON public.tradelines;
  CREATE POLICY "Users can update tradelines" ON public.tradelines FOR UPDATE USING (can_access_client(client_id));

  -- tradeline_bureau_states (via tradeline join)
  DROP POLICY IF EXISTS "Users can view tradeline bureau states" ON public.tradeline_bureau_states;
  CREATE POLICY "Users can view tradeline bureau states" ON public.tradeline_bureau_states FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tradelines t WHERE t.id = tradeline_id AND can_access_client(t.client_id)));
  DROP POLICY IF EXISTS "Users can insert tradeline bureau states" ON public.tradeline_bureau_states;
  CREATE POLICY "Users can insert tradeline bureau states" ON public.tradeline_bureau_states FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.tradelines t WHERE t.id = tradeline_id AND can_access_client(t.client_id)));
  DROP POLICY IF EXISTS "Users can update tradeline bureau states" ON public.tradeline_bureau_states;
  CREATE POLICY "Users can update tradeline bureau states" ON public.tradeline_bureau_states FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.tradelines t WHERE t.id = tradeline_id AND can_access_client(t.client_id)));

  -- bureau_responses
  DROP POLICY IF EXISTS "Users can view bureau responses" ON public.bureau_responses;
  CREATE POLICY "Users can view bureau responses" ON public.bureau_responses FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert bureau responses" ON public.bureau_responses;
  CREATE POLICY "Users can insert bureau responses" ON public.bureau_responses FOR INSERT WITH CHECK (can_access_client(client_id));

  -- dispute_letters
  DROP POLICY IF EXISTS "Users can view dispute letters" ON public.dispute_letters;
  CREATE POLICY "Users can view dispute letters" ON public.dispute_letters FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert dispute letters" ON public.dispute_letters;
  CREATE POLICY "Users can insert dispute letters" ON public.dispute_letters FOR INSERT WITH CHECK (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can update dispute letters" ON public.dispute_letters;
  CREATE POLICY "Users can update dispute letters" ON public.dispute_letters FOR UPDATE USING (can_access_client(client_id));

  -- weekly_update_renderings
  DROP POLICY IF EXISTS "Users can view weekly update renderings" ON public.weekly_update_renderings;
  CREATE POLICY "Users can view weekly update renderings" ON public.weekly_update_renderings FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert weekly update renderings" ON public.weekly_update_renderings;
  CREATE POLICY "Users can insert weekly update renderings" ON public.weekly_update_renderings FOR INSERT WITH CHECK (can_access_client(client_id));

  -- payment_plans
  DROP POLICY IF EXISTS "Users can view payment plans" ON public.payment_plans;
  CREATE POLICY "Users can view payment plans" ON public.payment_plans FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert payment plans" ON public.payment_plans;
  CREATE POLICY "Users can insert payment plans" ON public.payment_plans FOR INSERT WITH CHECK (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can update payment plans" ON public.payment_plans;
  CREATE POLICY "Users can update payment plans" ON public.payment_plans FOR UPDATE USING (can_access_client(client_id));

  -- payments
  DROP POLICY IF EXISTS "Users can view payments" ON public.payments;
  CREATE POLICY "Users can view payments" ON public.payments FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
  CREATE POLICY "Users can insert payments" ON public.payments FOR INSERT WITH CHECK (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can update payments" ON public.payments;
  CREATE POLICY "Users can update payments" ON public.payments FOR UPDATE USING (can_access_client(client_id));
END $policies$;

-- Storage buckets (idempotent via storage API in deployment; documented here)
-- client-letters, source-reports, client-deliverables
