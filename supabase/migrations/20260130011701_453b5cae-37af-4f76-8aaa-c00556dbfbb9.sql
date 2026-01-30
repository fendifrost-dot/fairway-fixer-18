-- Create enums for timeline_events
CREATE TYPE public.event_category AS ENUM ('Action', 'Response', 'Outcome', 'Note');

CREATE TYPE public.event_source AS ENUM (
  'Experian', 'TransUnion', 'Equifax', 
  'LexisNexis', 'CoreLogic', 'Innovis', 'Sagestream', 
  'ChexSystems', 'EWS', 'NCTUE', 
  'CFPB', 'BBB', 'AG', 'Other'
);

CREATE TYPE public.simple_priority AS ENUM ('Low', 'Medium', 'High');
CREATE TYPE public.simple_status AS ENUM ('Open', 'Done');

-- Create timeline_events table
CREATE TABLE public.timeline_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  event_date DATE NOT NULL,
  category public.event_category NOT NULL,
  source public.event_source,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT,
  related_accounts JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create simple tasks table for operator console
CREATE TABLE public.operator_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  priority public.simple_priority NOT NULL DEFAULT 'Medium',
  status public.simple_status NOT NULL DEFAULT 'Open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_tasks ENABLE ROW LEVEL SECURITY;

-- Helper function to check client access
CREATE OR REPLACE FUNCTION public.can_access_client(_client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients
    WHERE id = _client_id
    AND (owner_id = auth.uid() OR public.is_admin())
  )
$$;

-- RLS policies for timeline_events
CREATE POLICY "Users can view timeline events"
  ON public.timeline_events FOR SELECT
  USING (public.can_access_client(client_id));

CREATE POLICY "Users can insert timeline events"
  ON public.timeline_events FOR INSERT
  WITH CHECK (public.can_access_client(client_id));

CREATE POLICY "Users can update timeline events"
  ON public.timeline_events FOR UPDATE
  USING (public.can_access_client(client_id));

CREATE POLICY "Users can delete timeline events"
  ON public.timeline_events FOR DELETE
  USING (public.can_access_client(client_id));

-- RLS policies for operator_tasks
CREATE POLICY "Users can view operator tasks"
  ON public.operator_tasks FOR SELECT
  USING (public.can_access_client(client_id));

CREATE POLICY "Users can insert operator tasks"
  ON public.operator_tasks FOR INSERT
  WITH CHECK (public.can_access_client(client_id));

CREATE POLICY "Users can update operator tasks"
  ON public.operator_tasks FOR UPDATE
  USING (public.can_access_client(client_id));

CREATE POLICY "Users can delete operator tasks"
  ON public.operator_tasks FOR DELETE
  USING (public.can_access_client(client_id));

-- Indexes for performance
CREATE INDEX idx_timeline_events_client_id ON public.timeline_events(client_id);
CREATE INDEX idx_timeline_events_event_date ON public.timeline_events(event_date DESC);
CREATE INDEX idx_operator_tasks_client_id ON public.operator_tasks(client_id);
CREATE INDEX idx_operator_tasks_status ON public.operator_tasks(status);