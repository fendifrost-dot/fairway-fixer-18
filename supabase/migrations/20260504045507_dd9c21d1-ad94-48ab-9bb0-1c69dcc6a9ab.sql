CREATE TABLE public.timeline_event_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.timeline_events(id) ON DELETE CASCADE,
  drive_path text NOT NULL,
  file_url text,
  mime_type text NOT NULL,
  file_name text NOT NULL,
  size_bytes bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_tea_event_id ON public.timeline_event_attachments(event_id);

ALTER TABLE public.timeline_event_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tea"
  ON public.timeline_event_attachments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert tea"
  ON public.timeline_event_attachments FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update tea"
  ON public.timeline_event_attachments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete tea"
  ON public.timeline_event_attachments FOR DELETE
  TO authenticated USING (true);