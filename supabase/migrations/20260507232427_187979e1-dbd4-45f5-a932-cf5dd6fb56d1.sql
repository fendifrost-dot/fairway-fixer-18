ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS correlation_id text;

CREATE UNIQUE INDEX IF NOT EXISTS timeline_events_correlation_id_uniq
  ON public.timeline_events (correlation_id)
  WHERE correlation_id IS NOT NULL;