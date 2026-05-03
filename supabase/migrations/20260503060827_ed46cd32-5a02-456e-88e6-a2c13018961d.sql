ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS credit_scores jsonb NOT NULL DEFAULT '{}'::jsonb;