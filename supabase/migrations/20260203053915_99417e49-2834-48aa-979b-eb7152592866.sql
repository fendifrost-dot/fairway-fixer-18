-- Add columns to operator_tasks for enhanced scheduled events
-- HIGH-PRIORITY: linked_event_ids (link to timeline evidence), due_time (time component)
-- MEDIUM-PRIORITY: notes (free-text context), recurrence_rule (recurring events)

ALTER TABLE public.operator_tasks
  ADD COLUMN IF NOT EXISTS due_time time without time zone,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS linked_event_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  ADD COLUMN IF NOT EXISTS recurrence_rule text;

-- Index for efficient lookup of events by linked timeline events
CREATE INDEX IF NOT EXISTS idx_operator_tasks_linked_events
  ON public.operator_tasks USING GIN (linked_event_ids);

COMMENT ON COLUMN public.operator_tasks.due_time IS 'Optional time component (HH:MM) for time-sensitive deadlines';
COMMENT ON COLUMN public.operator_tasks.notes IS 'Free-text context for the scheduled event (not evidence)';
COMMENT ON COLUMN public.operator_tasks.linked_event_ids IS 'References to timeline_events.id for traceability';
COMMENT ON COLUMN public.operator_tasks.recurrence_rule IS 'Optional recurrence pattern (e.g., weekly, monthly)';