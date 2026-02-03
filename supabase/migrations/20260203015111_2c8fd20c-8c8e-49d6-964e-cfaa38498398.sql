-- 1) Add is_draft flag
ALTER TABLE public.timeline_events
ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;

-- 2) Drop whichever event_kind constraint exists (both possible names)
ALTER TABLE public.timeline_events
DROP CONSTRAINT IF EXISTS timeline_events_event_kind_check;

ALTER TABLE public.timeline_events
DROP CONSTRAINT IF EXISTS timeline_events_event_kind_allowed;

-- 3) Re-add single constraint with draft included
ALTER TABLE public.timeline_events
ADD CONSTRAINT timeline_events_event_kind_allowed
CHECK (event_kind IN ('action', 'response', 'outcome', 'draft'));

-- 4) Index (acceptable "good enough")
CREATE INDEX IF NOT EXISTS idx_timeline_events_is_draft
ON public.timeline_events (client_id, is_draft)
WHERE is_draft = false;