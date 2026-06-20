
DO $$ BEGIN
  CREATE TYPE public.payment_plan_status AS ENUM ('active', 'completed', 'delinquent', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('scheduled', 'paid', 'partial', 'overdue', 'waived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_plans TO authenticated;
GRANT ALL ON public.payment_plans TO service_role;

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

DROP TRIGGER IF EXISTS update_payment_plans_updated_at ON public.payment_plans;
CREATE TRIGGER update_payment_plans_updated_at
  BEFORE UPDATE ON public.payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $policies$ BEGIN
  DROP POLICY IF EXISTS "Users can view payment plans" ON public.payment_plans;
  CREATE POLICY "Users can view payment plans" ON public.payment_plans FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert payment plans" ON public.payment_plans;
  CREATE POLICY "Users can insert payment plans" ON public.payment_plans FOR INSERT WITH CHECK (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can update payment plans" ON public.payment_plans;
  CREATE POLICY "Users can update payment plans" ON public.payment_plans FOR UPDATE USING (can_access_client(client_id));

  DROP POLICY IF EXISTS "Users can view payments" ON public.payments;
  CREATE POLICY "Users can view payments" ON public.payments FOR SELECT USING (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
  CREATE POLICY "Users can insert payments" ON public.payments FOR INSERT WITH CHECK (can_access_client(client_id));
  DROP POLICY IF EXISTS "Users can update payments" ON public.payments;
  CREATE POLICY "Users can update payments" ON public.payments FOR UPDATE USING (can_access_client(client_id));
END $policies$;
