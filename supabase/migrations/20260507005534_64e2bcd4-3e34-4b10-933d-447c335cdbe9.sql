ALTER TABLE public.tradeline_bureau_states
  ADD COLUMN IF NOT EXISTS operator_disputed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS operator_disputed_reason text;