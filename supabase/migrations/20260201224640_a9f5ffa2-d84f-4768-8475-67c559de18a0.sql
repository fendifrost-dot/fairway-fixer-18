-- Create audit table for source corrections via drag-and-drop

CREATE TABLE public.source_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.timeline_events(id) ON DELETE CASCADE,
  from_source text NOT NULL,
  to_source text NOT NULL,
  corrected_by uuid NOT NULL REFERENCES auth.users(id),
  corrected_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  CONSTRAINT source_corrections_source_changed CHECK (from_source <> to_source),
  CONSTRAINT source_corrections_allowed_sources CHECK (
    from_source IN ('experian','transunion','equifax','innovis','lexisnexis','sagestream','corelogic','ftc','cfpb','bbb','ag')
    AND
    to_source IN ('experian','transunion','equifax','innovis','lexisnexis','sagestream','corelogic','ftc','cfpb','bbb','ag')
  )
);

-- Enable RLS
ALTER TABLE public.source_corrections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view corrections for events they can access
CREATE POLICY "Users can view source corrections"
ON public.source_corrections
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.timeline_events te
    WHERE te.id = source_corrections.event_id
      AND public.can_access_client(te.client_id)
  )
);

-- Policy: Users can insert corrections for events they can access
CREATE POLICY "Users can insert source corrections"
ON public.source_corrections
FOR INSERT
WITH CHECK (
  corrected_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.timeline_events te
    WHERE te.id = source_corrections.event_id
      AND public.can_access_client(te.client_id)
  )
);

-- Indexes
CREATE INDEX idx_source_corrections_event_id ON public.source_corrections(event_id);
CREATE INDEX idx_source_corrections_corrected_at ON public.source_corrections(corrected_at);