ALTER TABLE public.timeline_events
  ALTER COLUMN event_date DROP NOT NULL;

ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS event_kind text NOT NULL DEFAULT 'action',
  ADD COLUMN IF NOT EXISTS date_is_unknown boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS raw_line text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'timeline_events_event_kind_allowed'
  ) THEN
    ALTER TABLE public.timeline_events
      ADD CONSTRAINT timeline_events_event_kind_allowed
      CHECK (event_kind IN ('action','response','outcome'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_timeline_events_client_source_date
  ON public.timeline_events (client_id, source, event_date);