-- Record how each client entered Credit Guardian and where their payment stands.
--
-- Staff asked for two things the file could not answer: which clients came in as
-- website subscribers versus being added by hand, and whether a hand-added client
-- has paid in full, partially, or not at all. Neither fact existed anywhere: the
-- payment_plans / payments tables are empty and the Capital-site subscription
-- (continuumcapitalchicago-os) has no bridge into this database.
--
-- Two explicit columns, settable by staff in the app, by an enrolled MCP agent
-- (create_client / update_client), and by the Control Center API. Existing rows
-- all came in through the Add Client form or Control Center imports, so they
-- backfill as 'staff' / 'unknown'.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS intake_channel text NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS payment_standing text NOT NULL DEFAULT 'unknown';

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_intake_channel_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_intake_channel_check CHECK (
  intake_channel IN ('staff', 'agent', 'control_center', 'website_subscription')
);

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_payment_standing_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_payment_standing_check CHECK (
  payment_standing IN ('subscriber', 'paid_in_full', 'partial', 'unpaid', 'unknown')
);

COMMENT ON COLUMN public.clients.intake_channel IS
  'How the client entered the file: staff (Add Client form), agent (MCP create_client), control_center (cross-project API), website_subscription (Capital-site subscriber).';
COMMENT ON COLUMN public.clients.payment_standing IS
  'Staff-maintained payment state: subscriber, paid_in_full, partial, unpaid, unknown. Not derived from payment_plans.';

CREATE INDEX IF NOT EXISTS idx_clients_payment_standing ON public.clients (payment_standing);

-- Prove the end state.
DO $$
DECLARE
  v_missing integer;
BEGIN
  SELECT count(*) INTO v_missing
  FROM public.clients
  WHERE intake_channel IS NULL OR payment_standing IS NULL;
  IF v_missing <> 0 THEN
    RAISE EXCEPTION 'expected every client to carry intake_channel and payment_standing, % rows do not', v_missing;
  END IF;
END $$;
